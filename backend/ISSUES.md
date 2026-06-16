# Backend — Open Issues

> ⭐ **Star the repo before contributing:** [github.com/YOUR_ORG/ai-net](https://github.com/YOUR_ORG/ai-net)
> Click **Star** in the top right — it helps maintainers prioritize active contributors.

Active, in-progress issues for the `backend` of ai-net — a Node.js/TypeScript REST + WebSocket server that bridges the frontend, agent runtime, Stellar payment layer, and Venice AI. All `src/` directories are empty. Comment on the issue to claim it before opening a PR.

---

## Issue #21 — Bootstrap Express Server with Middleware Stack, Config, and Health Endpoint

**Label:** `in-progress` `backend` `core` `setup`

**Files to work on:**
```
backend/src/config/
backend/src/api/middleware/
backend/src/api/routes/
```

**Background:**
The entire backend is empty. The foundation must be built before any feature issue can proceed: an Express app with structured middleware (CORS, rate limiting, request logging, error handling), environment-based config validation, and a `/health` endpoint. Every other backend issue depends on this.

**What needs to be built:**
- `backend/src/config/index.ts`: loads and validates all env vars with `zod` at startup — fail fast if required vars are missing. Required vars: `PORT`, `STELLAR_NETWORK`, `VENICE_API_KEY`, `DATABASE_URL`
- `backend/src/api/middleware/`: `requestLogger.ts` (structured JSON logs via `pino`), `errorHandler.ts` (converts thrown errors to JSON responses), `rateLimiter.ts` (100 req/min per IP via `express-rate-limit`)
- `GET /health` route: returns `{ status: 'ok', uptime, version, stellarNetwork }`
- `GET /health/deep` route: checks Venice AI reachability and Stellar Horizon reachability; returns per-service status
- Graceful shutdown: `SIGTERM` drains in-flight requests before exiting

**Acceptance Criteria:**
- [ ] Server starts and `GET /health` returns `200` with correct fields
- [ ] Startup fails with a clear error message if `VENICE_API_KEY` is missing from env
- [ ] Rate limiter returns `429` after 101 requests from the same IP within 60s
- [ ] `errorHandler` middleware returns `{ error: { message, code } }` JSON for all unhandled throws
- [ ] `GET /health/deep` returns `{ venice: 'ok'|'unreachable', horizon: 'ok'|'unreachable' }`
- [ ] Graceful shutdown completes within 10s (test by sending SIGTERM during an active request)
- [ ] All config values accessed through the config module — no direct `process.env` calls elsewhere

---

## Issue #22 — Implement Task Submission API with DAG Generation and Persistent Task Store

**Label:** `in-progress` `backend` `core` `api` `complex`

**Files to work on:**
```
backend/src/api/routes/
backend/src/coordinator/
backend/src/db/
backend/src/types/
```

**Background:**
The primary backend function is accepting task submissions from the frontend, invoking the Coordinator to generate a DAG, persisting the task, and returning the DAG preview to the client. Currently nothing exists in these directories.

**What needs to be built:**
- `POST /api/tasks` route: accepts `{ prompt, maxBudgetXLM, agentPreferences[] }`, validates with Zod, calls Coordinator to decompose, persists task, returns `{ taskId, dagPreview, status: 'queued' }`
- `GET /api/tasks/:id` route: returns full task state including DAG node statuses and results
- `GET /api/tasks` route: returns paginated list of tasks filtered by `walletPublicKey` header
- `DELETE /api/tasks/:id` route: cancels a queued task (not a running one); returns `409` if task is already running
- Task store in `backend/src/db/`: use SQLite via `better-sqlite3` for local persistence. Schema: `tasks(id, prompt, walletPublicKey, status, dagJson, createdAt, updatedAt)`
- Task ID format: `nanoid(12)` prefixed with `task_`

**Acceptance Criteria:**
- [ ] `POST /api/tasks` with a valid prompt returns `201` with `taskId` and a DAG with ≥ 1 node
- [ ] `POST /api/tasks` with `maxBudgetXLM < 0.1` returns `400` with a descriptive error
- [ ] `GET /api/tasks/:id` returns `404` for unknown task IDs
- [ ] `DELETE /api/tasks/:id` on a running task returns `409 Conflict`
- [ ] Task persisted to SQLite is retrievable after server restart
- [ ] Pagination: `GET /api/tasks?page=1&pageSize=10` returns correct slice
- [ ] Unit tests cover all 4 routes with an in-memory SQLite database

---

## Issue #23 — WebSocket Server for Real-Time DAG Execution Event Streaming

**Label:** `in-progress` `backend` `websocket` `real-time` `complex`

**Files to work on:**
```
backend/src/api/routes/
backend/src/coordinator/
backend/src/types/
```

**Background:**
The frontend Task Monitoring page (frontend Issue #13) subscribes to `ws://localhost:3001/tasks/:id/stream` to receive live DAG execution events. This WebSocket server does not exist yet. It must emit typed events as the Coordinator executes each agent node.

**What needs to be built:**
- WebSocket upgrade handler at `ws://localhost:3001/tasks/:id/stream` using the `ws` library attached to the existing Express HTTP server
- `DAGEvent` types: `node_started`, `node_completed`, `node_failed`, `payment_locked`, `payment_released`, `task_completed`, `task_failed` — each with `{ type, nodeId, timestamp, payload }`
- `EventBus` singleton in `backend/src/coordinator/`: in-process pub/sub; Coordinator emits events; WebSocket handler subscribes per `taskId`
- Connection auth: client must send `{ walletPublicKey }` as first message; server validates it matches the task owner before streaming
- On connect for an already-running task: replay all past events for that task from the DB before streaming new ones
- Heartbeat: send `{ type: 'ping' }` every 30s; close connection if no `pong` within 10s

**Acceptance Criteria:**
- [ ] Client receives `node_started` event within 100ms of Coordinator starting that node
- [ ] Connecting with a `walletPublicKey` that doesn't own the task receives a `403` close frame
- [ ] Reconnecting mid-task replays all prior events in chronological order before new events
- [ ] Heartbeat closes stale connections after 10s of no pong (test with mocked timer)
- [ ] `EventBus` emitting 1000 events/s does not block the main thread (test with `setImmediate` batching)
- [ ] WebSocket connection is cleaned up from the `EventBus` subscription map on client disconnect
- [ ] Integration test: full task run emits events in correct order with no duplicates

---

## Issue #24 — Agent Registry API: CRUD Endpoints with On-Chain Verification

**Label:** `in-progress` `backend` `registry` `api`

**Files to work on:**
```
backend/src/registry/
backend/src/api/routes/
backend/src/db/
```

**Background:**
The frontend Agent Registry Browser (frontend Issue #14) fetches `GET /api/agents`. The backend must serve this from a local cache of the on-chain registry, synced periodically. It must also expose registration endpoints used by agents on startup.

**What needs to be built:**
- `GET /api/agents` — returns all registered agents; supports query params: `?capability=research`, `?minReputation=3`, `?maxPriceXLM=5`
- `GET /api/agents/:id` — returns single agent by ID
- `POST /api/agents/register` — called by agent on startup; body: `{ agentId, capabilities[], pricingXLM, endpoint, stellarPublicKey }`; verifies the Stellar account exists on testnet via Horizon before writing to DB
- `DELETE /api/agents/:id` — deregisters agent; requires a signed challenge proving ownership of the `stellarPublicKey`
- Background sync job in `backend/src/registry/`: polls Soroban contract events every 60s to detect on-chain registrations not submitted through this API; upserts into local DB
- DB schema: `agents(id, capabilities, pricingXLM, endpoint, stellarPublicKey, reputationScore, lastSeenAt)`

**Acceptance Criteria:**
- [ ] `GET /api/agents?capability=research` returns only agents with `'research'` in their capabilities array
- [ ] `POST /api/agents/register` with a non-existent Stellar account returns `400 StellarAccountNotFound`
- [ ] `DELETE /api/agents/:id` without a valid signed challenge returns `401`
- [ ] Background sync upserts an agent registered on-chain within 60s of the contract event
- [ ] `GET /api/agents` returns `[]` (not 500) when the DB is empty
- [ ] Reputation score updates when the agent completes tasks (via internal `updateReputation(agentId, delta)` function)
- [ ] All DB operations use parameterized queries — no string interpolation

---

## Issue #25 — Coordinator Service: Full DAG Execution Engine with Agent Dispatch and Retry

**Label:** `in-progress` `backend` `coordinator` `complex` `core`

**Files to work on:**
```
backend/src/coordinator/
backend/src/agents/
backend/src/types/
```

**Background:**
The Coordinator is the execution engine. It takes a decomposed DAG from the task submission flow, dispatches each node to the correct agent in topological order, handles retries on failure, and emits events to the WebSocket EventBus. This is the most complex single component in the backend.

**What needs to be built:**
- `Coordinator` class in `backend/src/coordinator/coordinator.ts`
- `executeDAG(taskId, dag: DAGNode[])`: resolves topological order, runs eligible nodes concurrently (max 3 parallel), passes upstream results as context to each node
- `dispatchNode(node, context)`: calls the assigned agent's HTTP endpoint (`POST <agent.endpoint>/execute`) with a timeout of 30s
- On agent timeout or 5xx: retry up to 3 times with the same agent; on 3rd failure, find next-cheapest agent from registry and retry once; if all fail, mark node `failed`
- `ConcurrencyLimiter`: semaphore limiting concurrent node executions to 3
- All state transitions emitted to `EventBus`: `node_started`, `node_completed`, `node_failed`
- Payment trigger: after each `node_completed`, call `PaymentService.release(taskId, nodeId)`

**Acceptance Criteria:**
- [ ] Nodes with no dependencies all start concurrently (test: 3-node DAG with no deps, assert all 3 start within 50ms)
- [ ] Topological order is respected: node B (depends on A) does not start until A completes
- [ ] Agent 30s timeout triggers retry, not an immediate failure
- [ ] After 3 retries with primary agent + 1 with fallback agent all fail, node status becomes `failed`
- [ ] `ConcurrencyLimiter` ensures never more than 3 nodes run simultaneously (test with 6-node parallel DAG)
- [ ] `PaymentService.release` is called exactly once per `node_completed` event
- [ ] Unit tests mock all agent HTTP calls; test full 5-node linear DAG execution in < 100ms

---

## Issue #26 — Implement Research Agent HTTP Service with Venice AI Integration

**Label:** `in-progress` `backend` `agent` `research`

**Files to work on:**
```
backend/src/agents/research/
```

**Background:**
Each agent runs as an internal HTTP service (or embedded module) exposing `POST /execute`. The Research Agent must accept a sub-task, call Venice AI, and return a structured result. The Coordinator calls this endpoint when dispatching research nodes.

**What needs to be built:**
- `ResearchAgent` class in `backend/src/agents/research/research.ts`
- `POST /execute` handler (or callable `execute(task)` method if embedded): accepts `{ taskId, nodeId, prompt, context }`, returns `AgentResult`
- System prompt engineering: instruct Venice to act as a research analyst; request JSON output with `summary`, `keyFindings[]`, `sources[]`, `confidence`
- Result validated with Zod before returning — if Venice returns malformed JSON, retry the call once with an explicit JSON-mode instruction appended to the prompt
- Self-registers in the agent registry on startup via `POST /api/agents/register`
- `confidence` score derived from number of sources cited: 0 sources = 0.3, 1–3 = 0.6, 4+ = 0.9

**Acceptance Criteria:**
- [ ] `execute` returns a valid `AgentResult` with all required fields for any non-empty prompt
- [ ] Malformed Venice response triggers exactly one retry with JSON-mode prompt
- [ ] `confidence` calculation matches the defined scoring rules (unit test with fixture source counts)
- [ ] Agent self-registers with capability `'research'` on startup — verify with `GET /api/agents?capability=research`
- [ ] Agent returns `{ error: 'VENICE_UNAVAILABLE' }` (not throws) when Venice is unreachable
- [ ] Unit tests mock `VeniceClient`; test normal path, malformed JSON retry, and Venice failure

---

## Issue #27 — Implement Risk, Coding, Design, and Report Agent Services

**Label:** `in-progress` `backend` `agent` `multi`

**Files to work on:**
```
backend/src/agents/risk/
backend/src/agents/coding/
backend/src/agents/design/
backend/src/agents/report/
```

**Background:**
After Research (Issue #26), the remaining four agents need identical structural treatment: a class implementing the `Agent` interface, Venice AI integration with agent-specific prompt engineering, Zod output validation, and self-registration. All four share the same pattern but differ in prompt and output schema.

**What needs to be built:**
- `RiskAgent`: output schema `{ risks: RiskItem[], overallRiskScore }`. Flags items with `likelihood ≥ 4 AND impact ≥ 4` as `critical: true`. Registers with capability `'risk'`
- `CodingAgent`: routes to `venice-code` model. Output: `{ language, code, explanation, testScaffold? }`. Rejects prompts matching a blocklist (`eval`, `exec`, `DROP TABLE`, `rm -rf`) with `UnsafeCodeRequestError`. Registers with capability `'coding'`
- `DesignAgent`: output schema `{ wireframes[], colorPalette[], componentHierarchy[], assetManifest[] }`. Registers with capability `'design'`
- `ReportAgent`: accepts `upstreamResults: AgentResult[]` in context. Assembles Markdown report with sections: Executive Summary, Findings, Risk Analysis, Recommendations, Conclusion. Throws `InsufficientContextError` if no upstream results. Registers with capability `'report'`
- All four agents share a common `BaseAgent` abstract class with `healthCheck()`, `register()`, and Zod validation logic

**Acceptance Criteria:**
- [ ] All 4 agents self-register on startup — `GET /api/agents` returns all 5 agent types after startup
- [ ] `CodingAgent` throws `UnsafeCodeRequestError` for any prompt containing blocklist terms (unit test)
- [ ] `RiskAgent` correctly marks all items with `likelihood ≥ 4, impact ≥ 4` as `critical` (unit test fixture)
- [ ] `ReportAgent` throws `InsufficientContextError` when `upstreamResults` is empty
- [ ] All agents return `{ error: 'VENICE_UNAVAILABLE' }` without throwing when Venice is unreachable
- [ ] `BaseAgent.healthCheck()` returns `false` (not throws) on Venice failure
- [ ] Each agent has unit tests covering: normal execution, Zod validation failure, Venice failure

---

## Issue #28 — Payment Service: Stellar Escrow Lock/Release/Refund with Idempotency

**Label:** `in-progress` `backend` `payment` `stellar` `complex`

**Files to work on:**
```
backend/src/payment/
backend/src/db/
```

**Background:**
Every agent payment in ai-net flows through the PaymentService. The Coordinator locks XLM in escrow when assigning a node to an agent, releases it on success, and refunds it on failure. The service must be idempotent — duplicate release calls for the same `taskId+nodeId` must not double-pay.

**What needs to be built:**
- `PaymentService` class in `backend/src/payment/payment.ts`
- `lock(taskId, nodeId, coordinatorKeypair, agentPublicKey, amountXLM)`: creates a Stellar claimable balance; persists `{ taskId, nodeId, balanceId, status: 'locked', amountXLM }` to DB
- `release(taskId, nodeId, coordinatorKeypair)`: claims the balance to the agent; updates DB status to `'released'`; idempotent — returns existing tx hash if already released
- `refund(taskId, nodeId, coordinatorKeypair)`: reclaims balance back to coordinator; updates DB status to `'refunded'`
- `getPaymentStatus(taskId, nodeId)`: returns current payment state from DB
- Exponential backoff retry (up to 5 attempts) on Horizon `TIMEOUT` and `TOO_MANY_REQUESTS` errors
- All amounts stored as BigInt stroops in DB; converted to XLM strings only for Horizon API calls

**Acceptance Criteria:**
- [ ] `lock` creates a real claimable balance on Stellar testnet and records it in DB
- [ ] Calling `release` twice for the same `taskId+nodeId` returns the same tx hash both times (no second Stellar tx)
- [ ] `refund` fails with `PaymentAlreadyReleasedError` if `release` was already called
- [ ] Horizon `TIMEOUT` triggers retry; 6th consecutive timeout throws `HorizonUnavailableError`
- [ ] All stroop ↔ XLM conversions are tested with edge-case amounts (0.0000001 XLM = 1 stroop)
- [ ] DB schema enforces unique constraint on `(taskId, nodeId)` to prevent duplicate lock records
- [ ] Integration test: full lock → release cycle on Stellar testnet with balance verification via Horizon

---

## Issue #29 — Network Statistics API with Aggregated Metrics and Time-Series Cache

**Label:** `in-progress` `backend` `api` `metrics`

**Files to work on:**
```
backend/src/api/routes/
backend/src/db/
backend/src/utils/
```

**Background:**
The frontend Dashboard (frontend Issue #16) calls `GET /api/stats` for network KPIs. This endpoint must aggregate data from the tasks DB, agents DB, and payment DB, and return metrics including a 24h time-series for sparkline charts. Raw DB aggregation on every request would be too slow — results must be cached.

**What needs to be built:**
- `GET /api/stats` route: returns `{ totalAgents, totalTasks, totalXLMTransacted, uptimePercent, tasksLast24h: TimePoint[], xlmLast24h: TimePoint[] }`
- `TimePoint`: `{ timestamp: ISO8601, value: number }` — 24 hourly data points
- `StatsCache` in `backend/src/utils/statsCache.ts`: caches the computed stats object in memory; invalidates every 60s; first request after invalidation triggers recompute, subsequent requests within 60s return cached value
- `uptimePercent`: computed as `(successful tasks / total tasks) * 100` over the last 7 days; returns `100` if no tasks exist
- `totalXLMTransacted`: sum of all `released` payment records in stroops, converted to XLM
- DB queries must use indexed columns — add migration to create indexes on `tasks.createdAt` and `payments.status`

**Acceptance Criteria:**
- [ ] `GET /api/stats` returns `200` with all required fields
- [ ] Second call within 60s does not re-query the DB (assert DB mock called once for two requests)
- [ ] `tasksLast24h` array has exactly 24 entries covering each hour of the last 24h
- [ ] `uptimePercent` returns `100` when all tasks succeeded; `0` when all failed; correct value for mixed fixture
- [ ] `totalXLMTransacted` is accurate to 7 decimal places (stroop precision)
- [ ] DB migration creates indexes on `tasks.createdAt` and `payments.status` without data loss
- [ ] Unit tests cover cache invalidation timing with mocked `Date.now()`

---

## Issue #30 — End-to-End Backend Integration Test: Full Pipeline from API to Stellar Testnet

**Label:** `in-progress` `backend` `testing` `e2e` `complex`

**Files to work on:**
```
backend/tests/e2e/
backend/tests/fixtures/
```

**Background:**
No integration tests exist that exercise the backend end-to-end: `POST /api/tasks` → Coordinator DAG execution → all 5 agents called → payments locked and released → WebSocket events emitted → final result queryable via `GET /api/tasks/:id`. This is the most critical test in the backend repo.

**What needs to be built:**
- `backend/tests/e2e/pipeline.test.ts` using Jest + `supertest`
- Test setup: start the Express server on a random port; fund a testnet Stellar account via Friendbot; register mock agents that return fixture results
- `POST /api/tasks` with prompt `"Generate a market-entry report for solar energy in Southeast Asia"`
- Poll `GET /api/tasks/:id` until `status === 'completed'` (max 120s timeout)
- Verify: all 5 DAG nodes completed, all payments released on Stellar testnet (check via Horizon), final report has all 5 sections
- WebSocket assertion: connect to `ws://localhost:<port>/tasks/:id/stream`, collect all events, assert correct event sequence
- `afterAll`: deregister mock agents, close server

**Acceptance Criteria:**
- [ ] Test passes end-to-end against Stellar testnet without manual steps
- [ ] All 5 DAG nodes appear as `completed` in the final `GET /api/tasks/:id` response
- [ ] Horizon API confirms at least 5 payment release transactions (one per agent node)
- [ ] WebSocket event sequence is: `node_started` × N → `node_completed` × N → `task_completed`
- [ ] No `node_failed` events appear in a successful run
- [ ] Test completes within 120s (Jest timeout configured accordingly)
- [ ] `.env.example` updated with `STELLAR_TEST_SECRET` and `VENICE_API_KEY` documented as required for E2E
- [ ] CI workflow runs this test suite on every PR to `main`
