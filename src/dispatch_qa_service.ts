import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError } from "./infrai_gateway.ts";
import { answerFieldQuestion } from "./work_order_qa.ts";

const questionBody = z.object({
  collection: z.string().min(1),
  question: z.string().min(3).max(500),
}).strict();

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/questions") {
    send(response, 404, { error: "Route not found" });
    return;
  }
  try {
    const input = questionBody.parse(await readJson(request));
    send(response, 200, await answerFieldQuestion(input.collection, input.question));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must contain a collection and question" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected service error" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Field-service QA listening on http://localhost:${port}`));
}
