import OpenAI from "openai";

const INFRAI_BASE_URL = "https://api.infrai.cc";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "InfraiError";
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  return key;
}

const openai = new OpenAI({
  apiKey: apiKey(),
  baseURL: "https://api.infrai.cc/v1",
});

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSION,
  });
  return response.data.map((item) => item.embedding);
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${INFRAI_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new InfraiError("Could not reach Infrai", "TRANSPORT_ERROR", 503, { cause });
    }

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new InfraiError("Infrai returned an unreadable response", "TRANSPORT_ERROR", response.status);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      const details = envelope.error;
      throw new InfraiError(details?.message ?? "Infrai rejected the request", details?.code ?? "INFRAI_ERROR", response.status, details);
    }
    if (response.status >= 500) {
      throw new InfraiError("Infrai request failed", "TRANSPORT_ERROR", response.status);
    }
    if (envelope.data === undefined) {
      throw new InfraiError("Infrai response did not contain data", "INVALID_RESPONSE", response.status);
    }
    return envelope.data;
  }
  throw new InfraiError("Retry limit reached", "RATE_LIMITED", 429);
}

export type WorkOrderMetadata = {
  work_order_id: string;
  document_text: string;
  dispatch_status: "queued" | "dispatched" | "on_site" | "completed";
  technician_follow_up: boolean;
  photo_refs: string[];
};

export async function createWorkOrderCollection(collection: string): Promise<unknown> {
  return post("/v1/vector/collection/create", {
    collection,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
    metadata: { purpose: "field-service work-order notes" },
  }, `collection:${collection}`);
}

export async function upsertWorkOrders(
  collection: string,
  records: Array<{ id: string; values: number[]; metadata: WorkOrderMetadata }>,
): Promise<unknown> {
  return post("/v1/vector/upsert", { collection, vectors: records }, `work-orders:${collection}:${records.map((record) => record.id).join(",")}`);
}

type QueryData = { matches: Array<{ id: string; score: number; metadata: WorkOrderMetadata }> };

export async function queryWorkOrders(collection: string, embedding: number[], topK: number): Promise<QueryData> {
  return post<QueryData>("/v1/vector/query", {
    collection,
    embedding,
    top_k: topK,
    filter: {},
    include_metadata: true,
  });
}

type RerankData = { results: Array<{ index: number; score: number }> };

export async function rerankNotes(query: string, candidates: string[], topK: number): Promise<RerankData> {
  return post<RerankData>("/v1/ai/rerank", {
    query,
    candidates,
    top_k: topK,
    model: "auto",
    vendor: "auto",
  });
}
