import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contactNameFrom(contacts: unknown[], phone: string): string | null {
  const contact = contacts.find((candidate) => isRecord(candidate) && candidate.wa_id === phone);
  return isRecord(contact) && isRecord(contact.profile) && typeof contact.profile.name === "string"
    ? contact.profile.name.slice(0, 120)
    : null;
}

function metaTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !/^\\d{1,12}$/.test(value)) return null;
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function messageTextFrom(item: Record<string, unknown>, type: string): string {
  if (type === "text" && isRecord(item.text) && typeof item.text.body === "string") return item.text.body;
  if (type === "interactive" && isRecord(item.interactive)) {
    const interactive = item.interactive;
    if (isRecord(interactive.button_reply) && typeof interactive.button_reply.title === "string") return interactive.button_reply.title;
    if (isRecord(interactive.list_reply) && typeof interactive.list_reply.title === "string") return interactive.list_reply.title;
  }
  if (type === "button" && isRecord(item.button) && typeof item.button.text === "string") return item.button.text;
  return "";
}

async function broadcastCallEvents(payload: Record<string, unknown>): Promise<number> {
  const ownerId = Deno.env.get("WHATSAPP_OWNER_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configuredPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error("WHATSAPP_OWNER_ID is not configured as a valid account UUID.");
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured for call signaling.");
  }
  if (!configuredPhoneNumberId || !/^\d{5,30}$/.test(configuredPhoneNumberId)) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured for call signaling.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let delivered = 0;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "calls" || !isRecord(change.value)) continue;
      const value = change.value;
      // A valid Meta signature authenticates the app, not the specific phone number.
      // Only forward events explicitly addressed to this Caçador account number.
      const metadata = isRecord(value.metadata) ? value.metadata : null;
      if (metadata?.phone_number_id !== configuredPhoneNumberId) continue;
      const calls = Array.isArray(value.calls) ? value.calls : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      const topic = `whatsapp-calls:${ownerId}`;
      const channel = supabase.channel(topic, { config: { private: true } });
      const result = await channel.send({
        type: "broadcast",
        event: "call_signal",
        payload: {
          entry_id: isRecord(entry) ? entry.id : null,
          metadata: value.metadata ?? null,
          calls,
          statuses,
          errors: value.errors ?? null,
          received_at: new Date().toISOString(),
        },
      });
      await supabase.removeChannel(channel);
      if (result !== "ok") throw new Error(`Realtime broadcast failed: ${String(result)}`);
      delivered += calls.length + statuses.length;
    }
  }
  return delivered;
}


async function broadcastIncomingMessages(payload: Record<string, unknown>): Promise<number> {
  const ownerId = Deno.env.get("WHATSAPP_OWNER_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configuredPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error("WHATSAPP_OWNER_ID is not configured as a valid account UUID.");
  }
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are not configured for message delivery.");
  if (!configuredPhoneNumberId || !/^\d{5,30}$/.test(configuredPhoneNumberId)) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured for message delivery.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let delivered = 0;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const value = change.value;
      const metadata = isRecord(value.metadata) ? value.metadata : null;
      if (metadata?.phone_number_id !== configuredPhoneNumberId) continue;
      const incoming = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const topic = "whatsapp-calls:" + ownerId;
      for (const item of incoming) {
        if (!isRecord(item) || typeof item.from !== "string" || !/^\d{8,15}$/.test(item.from) ||
          typeof item.id !== "string" || item.id.length < 8 || item.id.length > 200) continue;
        const type = typeof item.type === "string" ? item.type : "unknown";
        // Persist the verified Meta webhook before broadcasting. The unique
        // (owner_id, message_id) key makes webhook retries idempotent.
        const mediaPayload = isRecord(item[type]) ? item[type] : null;
        const { error: persistError } = await supabase
          .from("whatsapp_inbox_messages")
          .upsert({
            owner_id: ownerId,
            message_id: item.id,
            from_phone: item.from,
            contact_name: contactNameFrom(contacts, item.from),
            message_type: type,
            text_body: messageTextFrom(item, type).slice(0, 4096) || null,
            media_id: mediaPayload && typeof mediaPayload.id === "string" ? mediaPayload.id : null,
            media_mime_type: mediaPayload && typeof mediaPayload.mime_type === "string" ? mediaPayload.mime_type : null,
            meta_timestamp: metaTimestamp(item.timestamp),
            phone_number_id: configuredPhoneNumberId,
            raw_message: { id: item.id, type, timestamp: typeof item.timestamp === "string" ? item.timestamp : null },
          }, { onConflict: "owner_id,message_id", ignoreDuplicates: true });
        if (persistError) throw new Error("Could not persist incoming WhatsApp message: " + persistError.message);
        const messageText = messageTextFrom(item, type);
        if (!messageText.trim()) continue;
        const contactName = contactNameFrom(contacts, item.from);
        const channel = supabase.channel(topic, { config: { private: true } });
        const result = await channel.send({
          type: "broadcast",
          event: "incoming_message",
          payload: {
            message_id: item.id,
            from: item.from,
            timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
            message_type: type,
            text: messageText.slice(0, 4096),
            contact_name: contactName,
            phone_number_id: configuredPhoneNumberId,
            received_at: new Date().toISOString(),
          },
        });
        await supabase.removeChannel(channel);
        if (result !== "ok") throw new Error("Realtime message broadcast failed: " + String(result));
        delivered += 1;
      }
    }
  }
  return delivered;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const supplied = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)),
  );
  const expected = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return constantTimeEqual(expected, supplied);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_APP_SECRET");

  if (request.method === "GET") {
    if (!verifyToken) return json({ error: "Webhook is not configured" }, 503);

    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode !== "subscribe" ||
      !token ||
      !challenge ||
      !constantTimeEqual(token, verifyToken)
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (request.method === "POST") {
    if (!appSecret) return json({ error: "Webhook is not configured" }, 503);

    const rawBody = await request.text();
    const valid = await verifyMetaSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!valid) return json({ error: "Invalid signature" }, 401);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
      return json({ error: "Unsupported webhook object" }, 400);
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    const hasCallEvents = entries.some((entry) =>
      isRecord(entry) && Array.isArray(entry.changes) &&
      entry.changes.some((change) => isRecord(change) && change.field === "calls")
    );
    const hasMessageEvents = entries.some((entry) =>
      isRecord(entry) && Array.isArray(entry.changes) &&
      entry.changes.some((change) => isRecord(change) && change.field === "messages")
    );

    let callEventsForwarded = 0;
    let messagesForwarded = 0;
    try {
      if (hasCallEvents) callEventsForwarded = await broadcastCallEvents(payload);
      if (hasMessageEvents) messagesForwarded = await broadcastIncomingMessages(payload);
    } catch (error) {
      console.error("[whatsapp-webhook] event forwarding failed:", error);
      return json({ error: "WhatsApp event delivery is temporarily unavailable" }, 503);
    }
    return json({
      received: true,
      processed: hasCallEvents || hasMessageEvents,
      call_events_forwarded: callEventsForwarded,
      messages_forwarded: messagesForwarded,
    });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, POST" },
  });
});
