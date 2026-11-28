import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function validPhone(value: unknown): value is string {
  return typeof value === "string" && /^\+?[1-9]\d{7,14}$/.test(value);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const ownerId = Deno.env.get("WHATSAPP_OWNER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");
  if (!supabaseUrl || !publishableKey || !ownerId) return json({ error: "Call control is not configured for the account." }, 503);

  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user || authData.user.id !== ownerId) return json({ error: "Not authorized for this WhatsApp number." }, 403);
  if (!accessToken || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) || !graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
    return json({ error: "WhatsApp Cloud API credentials are not configured." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid request body." }, 400);
    body = value as Record<string, unknown>;
  } catch { return json({ error: "Invalid JSON." }, 400); }

  const action = body.action;
  const phone = body.to;
  const callId = body.call_id;
  const sdp = body.sdp;
  if (!["request_permission", "connect", "pre_accept", "accept", "reject", "terminate", "get_call_settings", "get_call_permission_status"].includes(String(action))) {
    return json({ error: "Unsupported call action." }, 400);
  }
  if (["request_permission", "connect", "get_call_permission_status"].includes(String(action)) && !validPhone(phone)) {
    return json({ error: "Use the customer's international phone number, including country code." }, 400);
  }
  if (["connect", "pre_accept", "accept"].includes(String(action)) && (typeof sdp !== "string" || sdp.length < 20 || sdp.length > 20000)) {
    return json({ error: "A valid WebRTC SDP description is required." }, 400);
  }
  if (["pre_accept", "accept", "reject", "terminate"].includes(String(action)) && (typeof callId !== "string" || callId.length < 8 || callId.length > 200)) {
    return json({ error: "A valid WhatsApp call_id is required." }, 400);
  }

  let path = `${phoneNumberId}/calls`;
  let method = "POST";
  let payload: Record<string, unknown> = { messaging_product: "whatsapp", action };
  if (action === "get_call_settings") { path = `${phoneNumberId}/call_settings`; method = "GET"; payload = {}; }
  else if (action === "get_call_permission_status") { path = `${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(String(phone).replace(/^\+/, ""))}`; method = "GET"; payload = {}; }
  else if (action === "request_permission") {
    path = `${phoneNumberId}/messages`;
    const approvedTemplate = Deno.env.get("WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME")?.trim();
    const templateLanguage = Deno.env.get("WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE")?.trim() || "pt_PT";
    if (approvedTemplate) {
      if (!/^[a-z0-9_]{1,512}$/.test(approvedTemplate) || !/^[a-z]{2}_[A-Z]{2}$/.test(templateLanguage)) {
        return json({ error: "The configured call-permission template name or language is invalid." }, 503);
      }
      // The template must already be approved in WhatsApp Manager and contain
      // a CALL_PERMISSION_REQUEST component. This path works outside 24h windows.
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: String(phone).replace(/^\+/, ""),
        type: "template",
        template: { name: approvedTemplate, language: { code: templateLanguage } },
      };
    } else {
      // Free-form permission requests are only accepted while the customer
      // service window is open. Configure an approved template for cold leads.
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: String(phone).replace(/^\+/, ""),
        type: "interactive",
        interactive: {
          type: "call_permission_request",
          action: { name: "call_permission_request" },
          body: { text: typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1024) : "Gostaríamos de falar contigo por chamada WhatsApp sobre a nossa proposta. Autorizas que te liguemos?" },
        },
      };
    }
  } else {
    if (phone) payload.to = String(phone).replace(/^\+/, "");
    if (callId) payload.call_id = callId;
    if (sdp) payload.session = { sdp_type: action === "connect" ? "offer" : "answer", sdp };
  }

  try {
    // Never place a business-initiated call unless Meta explicitly says start_call is allowed.
    if (action === "connect") {
      const permissionResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(String(phone).replace(/^\+/, ""))}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        },
      );
      const permission = await permissionResponse.json().catch(() => ({}));
      if (!permissionResponse.ok) {
        return json({
          error: permission?.error?.message ?? "Could not verify the customer's WhatsApp call permission.",
          code: permission?.error?.code ?? null,
        }, permissionResponse.status >= 500 ? 502 : 400);
      }
      const canStartCall = Array.isArray(permission?.actions) &&
        permission.actions.some((item: { action_name?: string; can_perform_action?: boolean }) =>
          item.action_name === "start_call" && item.can_perform_action === true
        );
      if (!canStartCall) {
        return json({
          error: "A Meta ainda não confirma autorização para ligar a este cliente. Envia o pedido de autorização e aguarda a aprovação no WhatsApp.",
          permission_status: permission?.permission?.status ?? "unknown",
        }, 403);
      }
    }

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: result?.error?.message ?? `Meta Graph API returned HTTP ${response.status}`, code: result?.error?.code ?? null }, response.status >= 500 ? 502 : 400);
    return json({ ok: true, result });
  } catch (error) {
    console.error("[whatsapp-call-control] Meta request failed:", error);
    return json({ error: "Could not reach WhatsApp Calling API." }, 502);
  }
});
