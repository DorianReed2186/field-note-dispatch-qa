import { answerFromWorkOrder, type DispatchAnswer } from "./follow_up_decision.ts";
import { embed, queryWorkOrders, rerankNotes } from "./infrai_gateway.ts";

export async function answerFieldQuestion(collection: string, question: string): Promise<DispatchAnswer> {
  const [questionEmbedding] = await embed([question]);
  const vectorResult = await queryWorkOrders(collection, questionEmbedding, 6);
  if (vectorResult.matches.length === 0) throw new Error("No work-order evidence matched the question");

  const candidates = vectorResult.matches.map((match) => match.metadata.document_text);
  const reranked = await rerankNotes(question, candidates, 1);
  const winner = reranked.results[0];
  if (!winner || !vectorResult.matches[winner.index]) throw new Error("No work-order evidence survived reranking");

  return answerFromWorkOrder(vectorResult.matches[winner.index].metadata);
}
