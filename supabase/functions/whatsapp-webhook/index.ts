const encoder = new TextEncoder();

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

    // Acknowledge only verified Meta deliveries. Event persistence and message
    // processing are intentionally not enabled until the owner-scoped storage
    // model and retention policy are in place.
    const objectType =
      typeof payload === "object" && payload !== null && "object" in payload
        ? String((payload as { object?: unknown }).object ?? "")
        : "";

    if (objectType !== "whatsapp_business_account") {
      return json({ error: "Unsupported webhook object" }, 400);
    }

    return json({ received: true, processed: false });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, POST" },
  });
});
