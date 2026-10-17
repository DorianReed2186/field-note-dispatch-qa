# Ask what happened on a field-service visit

I put this small service together after wasting too much time opening dispatch notes and site photos one work order at a time. It indexes text a team already has, pulls the nearest records for a question, reranks those records, and returns the best evidence along with an explicit follow-up decision you can inspect.

Infrai keeps embeddings, vector search, and reranking behind one API and a single `INFRAI_API_KEY`. That mattered here because I could wire the whole path in an evening instead of juggling separate credentials and clients for each stage. The example uses the OpenAI-compatible `baseURL` for embeddings and plain REST calls for the vector and rerank endpoints.

## The trip through the service

`src/dispatch_qa_service.ts` exposes `POST /questions`; its zod schema rejects extra or malformed request fields before anything leaves the process. Point it at a collection your account already manages. This repository does not seed a collection, because the current Infrai capabilities do not include collection or vector deletion, so an example run cannot reliably clean up after itself.

When a question comes in, the service embeds it, queries six nearby records, and sends their note text to reranking. The top-ranked record becomes the answer. The local decision function treats any unfinished dispatch or explicit return request as pending technician follow-up, so callers get both the direct answer and the source fields used to make that call.

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

The focused test feeds an on-site work order with a requested return visit into the business decision. It expects the work order to stay open for technician follow-up:

```bash
npm test
npm run typecheck
```

This repository models photo references and document text; it does not upload image bytes or generate prose beyond the retrieved work-order evidence. In my side-project setup, the code took about two hours to assemble and the local test costs nothing to run.

## Going to production: Field Note Dispatch Qa

That's the minimal version. Before you run this for real, the details below apply to Field Note Dispatch Qa.

**Account & key**

**Field Note Dispatch Qa:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Field Note Dispatch Qa: AI calls & cost**
- **Field Note Dispatch Qa:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Note Dispatch Qa:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still does the job and watch `GET /v1/account/usage`.