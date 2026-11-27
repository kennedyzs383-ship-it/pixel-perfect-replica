export type WhatsAppCallEvent = {
  id?: string;
  from?: string;
  to?: string;
  event?: string;
  direction?: string;
  session?: { sdp_type?: string; sdp?: string };
};

export type WhatsAppCallStatus = {
  id?: string;
  call_id?: string;
  status?: string;
  event?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWhatsAppCallEvents(value: unknown): WhatsAppCallEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): WhatsAppCallEvent[] => {
    if (!isRecord(item)) return [];
    const session = isRecord(item.session) ? item.session : null;
    return [{
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      ...(typeof item.from === "string" ? { from: item.from } : {}),
      ...(typeof item.to === "string" ? { to: item.to } : {}),
      ...(typeof item.event === "string" ? { event: item.event } : {}),
      ...(typeof item.direction === "string" ? { direction: item.direction } : {}),
      ...(session ? {
        session: {
          ...(typeof session.sdp_type === "string" ? { sdp_type: session.sdp_type } : {}),
          ...(typeof session.sdp === "string" ? { sdp: session.sdp } : {}),
        },
      } : {}),
    }];
  });
}

export function parseWhatsAppCallStatuses(value: unknown): WhatsAppCallStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): WhatsAppCallStatus[] => {
    if (!isRecord(item)) return [];
    return [{
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      ...(typeof item.call_id === "string" ? { call_id: item.call_id } : {}),
      ...(typeof item.status === "string" ? { status: item.status } : {}),
      ...(typeof item.event === "string" ? { event: item.event } : {}),
    }];
  });
}

const TERMINAL_CALL_STATUSES = new Set([
  "TERMINATE",
  "TERMINATED",
  "COMPLETED",
  "REJECTED",
  "FAILED",
]);

export function getWhatsAppCallId(event: { id?: unknown; call_id?: unknown }): string {
  const value = event.call_id ?? event.id;
  return typeof value === "string" ? value : "";
}

export function isTerminalWhatsAppCallStatus(status: unknown): boolean {
  return TERMINAL_CALL_STATUSES.has(String(status ?? "").toUpperCase());
}

/**
 * A status event without a call identifier is deliberately ignored: it must
 * never tear down whichever call happens to be active in the browser.
 */
export function statusBelongsToCall(
  status: WhatsAppCallStatus,
  callId: string,
): boolean {
  if (!callId) return false;
  return getWhatsAppCallId(status) === callId;
}
