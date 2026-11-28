import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp)|audio\/(aac|amr|mpeg|mp4|ogg|opus|wav|webm)|video\/(mp4|3gpp)|application\/pdf|text\/plain)$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const requestLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(requestLength) || requestLength < 0 || requestLength > 16 * 1024) {
      return json({ error: "Request body is too large or has an invalid length." }, 413);
    }
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ownerId = Deno.env.get("WHATSAPP_OWNER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !ownerId || !accessToken ||
      !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) ||
      !graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
    return json({ error: "WhatsApp media access is not configured on the server." }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user || authData.user.id !== ownerId) {
    return json({ error: "Not authorized for this WhatsApp inbox." }, 403);
  }

  let mediaId: string;
  let messageId: string;
  try {
    // Enforce the limit while streaming, including requests without Content-Length.
    if (!request.body) return json({ error: "Request body is required." }, 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bodyBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > 16 * 1024) {
        await reader.cancel();
        return json({ error: "Request body is too large." }, 413);
      }
      chunks.push(value);
    }
    const bodyBuffer = new Uint8Array(bodyBytes);
    let bodyOffset = 0;
    for (const chunk of chunks) {
      bodyBuffer.set(chunk, bodyOffset);
      bodyOffset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bodyBuffer));
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body." }, 400);
    const payload = body as Record<string, unknown>;
    mediaId = typeof payload.media_id === "string" ? payload.media_id : "";
    messageId = typeof payload.message_id === "string" ? payload.message_id : "";
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(mediaId) || messageId.length < 8 || messageId.length > 200) {
    return json({ error: "A valid media_id and message_id are required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: message, error: lookupError } = await admin
    .from("whatsapp_inbox_messages")
    .select("media_id, media_mime_type, phone_number_id")
    .eq("owner_id", ownerId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (lookupError) {
    console.error("[whatsapp-media] inbox lookup failed:", lookupError.message);
    return json({ error: "Could not verify media ownership." }, 503);
  }
  if (!message || message.media_id !== mediaId || message.phone_number_id !== phoneNumberId) {
    return json({ error: "Media not found in this account's WhatsApp inbox." }, 404);
  }

  try {
    const metadataResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    const metadata = await metadataResponse.json().catch(() => ({}));
    if (!metadataResponse.ok || typeof metadata?.url !== "string") {
      return json({ error: "Meta did not provide a downloadable media URL.", code: metadata?.error?.code ?? null }, 502);
    }

    const mediaUrl = new URL(metadata.url);
    const trustedHost = mediaUrl.hostname === "lookaside.fbsbx.com" ||
      mediaUrl.hostname.endsWith(".fbcdn.net");
    if (mediaUrl.protocol !== "https:" || (mediaUrl.port !== "" && mediaUrl.port !== "443") || !trustedHost || mediaUrl.username || mediaUrl.password) {
      return json({ error: "Meta returned an untrusted media URL." }, 502);
    }

    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!mediaResponse.ok || !mediaResponse.body) {
      return json({ error: "Could not download the media from Meta." }, 502);
    }

    const mime = (mediaResponse.headers.get("content-type") ?? message.media_mime_type ?? "")
      .split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.test(mime)) {
      await mediaResponse.body.cancel();
      return json({ error: "This media format is not allowed for inline processing.", mime_type: mime || "unknown" }, 415);
    }
    const declaredLength = Number(mediaResponse.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_MEDIA_BYTES) {
      await mediaResponse.body.cancel();
      return json({ error: "Media exceeds the 20 MB processing limit." }, 413);
    }

    const reader = mediaResponse.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await reader.cancel();
        return json({ error: "Media exceeds the 20 MB processing limit." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": mime,
        "content-length": String(bytes.byteLength),
        "content-disposition": "inline",
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "vary": "authorization",
      },
    });
  } catch (error) {
    console.error("[whatsapp-media] media retrieval failed:", error);
    return json({ error: "WhatsApp media retrieval failed temporarily." }, 502);
  }
});
