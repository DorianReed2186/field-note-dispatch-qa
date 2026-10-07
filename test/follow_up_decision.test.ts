import { describe, expect, it } from "vitest";
import { answerFromWorkOrder } from "../src/follow_up_decision.ts";

describe("technician follow-up decision", () => {
  it("keeps an on-site repair open when the technician requested a return visit", () => {
    const result = answerFromWorkOrder({
      work_order_id: "WO-1048",
      document_text: "The cracked supply fitting needs a return visit.",
      dispatch_status: "on_site",
      technician_follow_up: true,
      photo_refs: ["photos/WO-1048-fitting.jpg"],
    });

    expect(result.needsTechnicianFollowUp).toBe(true);
    expect(result.dispatchStatus).toBe("on_site");
    expect(result.answer).toContain("still needs technician follow-up");
  });
});
