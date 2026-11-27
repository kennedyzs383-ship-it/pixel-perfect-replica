import { describe, expect, it } from "vitest";
import {
  getWhatsAppCallId,
  isTerminalWhatsAppCallStatus,
  statusBelongsToCall,
} from "./cacador-call-events";

describe("WhatsApp call event helpers", () => {
  it("reads call identifiers from call_id or id", () => {
    expect(getWhatsAppCallId({ call_id: "call-a" })).toBe("call-a");
    expect(getWhatsAppCallId({ id: "call-b" })).toBe("call-b");
    expect(getWhatsAppCallId({})).toBe("");
  });

  it("recognizes terminal states but keeps ACCEPTED non-terminal", () => {
    for (const status of ["TERMINATE", "TERMINATED", "COMPLETED", "REJECTED", "FAILED"]) {
      expect(isTerminalWhatsAppCallStatus(status)).toBe(true);
    }
    expect(isTerminalWhatsAppCallStatus("ACCEPTED")).toBe(false);
    expect(isTerminalWhatsAppCallStatus("RINGING")).toBe(false);
  });

  it("only applies status events to the matching active call", () => {
    expect(statusBelongsToCall({ call_id: "call-new", status: "FAILED" }, "call-new")).toBe(true);
    expect(statusBelongsToCall({ call_id: "call-old", status: "FAILED" }, "call-new")).toBe(false);
    expect(statusBelongsToCall({ status: "FAILED" }, "call-new")).toBe(false);
    expect(statusBelongsToCall({ call_id: "call-new" }, "")).toBe(false);
  });
});
