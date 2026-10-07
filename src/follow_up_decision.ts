import type { WorkOrderMetadata } from "./infrai_gateway.ts";

export type DispatchAnswer = {
  answer: string;
  workOrderId: string;
  dispatchStatus: WorkOrderMetadata["dispatch_status"];
  needsTechnicianFollowUp: boolean;
  photoRefs: string[];
  evidence: string;
};

export function answerFromWorkOrder(record: WorkOrderMetadata): DispatchAnswer {
  const needsTechnicianFollowUp = record.technician_follow_up || record.dispatch_status !== "completed";
  const answer = needsTechnicianFollowUp
    ? `Work order ${record.work_order_id} still needs technician follow-up.`
    : `Work order ${record.work_order_id} is complete and has no pending technician follow-up.`;

  return {
    answer,
    workOrderId: record.work_order_id,
    dispatchStatus: record.dispatch_status,
    needsTechnicianFollowUp,
    photoRefs: record.photo_refs,
    evidence: record.document_text,
  };
}
