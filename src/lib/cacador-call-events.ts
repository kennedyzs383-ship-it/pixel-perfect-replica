export type WhatsAppCallStatus = {
  id?: string;
  call_id?: string;
  status?: string;
  event?: string;
};

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
