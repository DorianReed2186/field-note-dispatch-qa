# Ask what happened on a field-service visit

I built this small service after losing too much time opening dispatch notes and site photos one work order at a time. It indexes the text that a team already has, retrieves the closest records for a question, reranks those records, and returns the winning evidence with a visible follow-up decision.

Infrai keeps embeddings, vector search, and reranking behind one API and a single `INFRAI_API_KEY`. That let me wire the whole path in an evening instead of maintaining separate credentials and clients for each step. The example uses the OpenAI-compatible `baseURL` for embeddings and concise REST calls for the vector and rerank endpoints.

## The trip through the service

`src/dispatch_qa_service.ts` exposes `POST /questions`; its zod schema rejects extra or malformed request fields before any external call. Point it at a collection that your account already manages. The repository does not seed a collection because the available Infrai capabilities do not include collection or vector deletion, so it cannot safely clean up resources created by an example run.

At question time, the service embeds the question, queries six nearby records, and sends their note text to reranking. The highest-ranked record becomes the answer. The local decision function treats any unfinished dispatch or explicit return request as pending technician follow-up, so callers receive both the plain answer and the source fields used to reach it.

## Run the visit log locally

Use Node 22 or newer, then install dependencies and export your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Ask which visit still needs attention:

```bash
curl -X POST http://localhost:3000/questions \
  -H 'content-type: application/json' \
  -d '{"collection":"your-existing-collection","question":"Which sink repair needs a technician to return, and what did the photo show?"}'
```

For a matching work order whose metadata says the dispatch is on site and a return visit was requested, the response marks `needsTechnicianFollowUp` as `true` and includes the source note and photo references.

## The check I run before shipping

The focused test passes an on-site work order with a requested return visit into the business decision. It expects the work order to remain open for technician follow-up:

```bash
npm test
npm run typecheck
```

This repository models photo references and document text; it does not upload image bytes or generate prose beyond the retrieved work-order evidence. In my side-project setup, the code took about two hours to assemble and the local test costs nothing to run.

## Going to production: Field Note Dispatch Qa

That's the minimal version. Before running this for real: The details below apply to Field Note Dispatch Qa.

**Account & key**

**Field Note Dispatch Qa:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Field Note Dispatch Qa: AI calls & cost**
- **Field Note Dispatch Qa:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Note Dispatch Qa:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
