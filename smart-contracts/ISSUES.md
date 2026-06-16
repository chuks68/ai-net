# Smart Contracts — Open Issues

> ⭐ **Please star the repository before contributing!** It helps the project grow and signals to maintainers that you're an active contributor.
> [github.com/YOUR_ORG/ai-net](https://github.com/YOUR_ORG/ai-net) → click **Star** in the top right.

These are active, in-progress issues for the `smart-contracts` layer of ai-net. Each issue maps directly to empty source directories that need implementation. Read the whole issue before starting. Comment on the GitHub issue to claim it before opening a PR.

---

## Issue #1 — Implement On-Chain Agent Registry with Soroban

**Label:** `in-progress` `core` `smart-contract` `good-first-contract`

**Files to work on:**
```
smart-contracts/src/registry/registry.ts
smart-contracts/tests/registry.test.ts
```

**Background:**
The Agent Registry is the backbone of ai-net. Every agent (Research, Risk, Coding, Design, Report) must register itself on-chain with a Stellar account, declared capabilities, service pricing in XLM, and a reputation score. Currently the registry directory is empty. Without this, no other component of the system can function — the Coordinator cannot discover agents, and payments cannot be routed.

**What needs to be built:**
Implement a TypeScript client that wraps a Soroban smart contract interaction for agent registration. The registry must support:
- `registerAgent(agentId, capabilities[], pricingXLM, endpoint)` — writes agent metadata on-chain via Soroban contract invocation
- `lookupAgent(capability)` — returns all agents matching a capability from on-chain state
- `deregisterAgent(agentId, signerKeypair)` — removes agent, requires signature from registering account
- `updatePricing(agentId, newPrice, signerKeypair)` — updates service price on-chain

The Soroban contract itself (Rust) should be defined in `smart-contracts/contracts/registry/` with the TypeScript client in `src/registry/registry.ts`.

**Acceptance Criteria:**
- [ ] `registerAgent` submits and confirms a Soroban transaction on Stellar testnet
- [ ] `lookupAgent('research')` returns at least one registered agent in integration test
- [ ] `deregisterAgent` fails if called with a keypair that did not register the agent (auth error)
- [ ] `updatePricing` emits a Soroban event that can be read off-chain
- [ ] All registry reads are cached locally with a 30s TTL to avoid redundant RPC calls
- [ ] Unit tests cover all four functions with mocked Stellar SDK
- [ ] Integration test runs against Stellar testnet in `tests/registry.test.ts`
- [ ] TypeScript types for `AgentRecord`, `Capability`, and `RegistryEvent` defined in a shared types file

---

## Issue #2 — Build the Coordinator Agent with DAG-Based Task Decomposition

**Label:** `in-progress` `core` `coordinator` `complex`

**Files to work on:**
```
smart-contracts/src/coordinator/coordinator.ts
```

**Background:**
The Coordinator is the brain of ai-net. When a user submits a task (e.g. "Generate a market-entry report for solar energy in Southeast Asia"), the Coordinator must decompose it into a directed acyclic graph (DAG) of sub-tasks, assign each sub-task to the cheapest capable agent from the registry, sequence execution respecting dependencies, collect results, and trigger payments. Currently `coordinator.ts` is empty.

**What needs to be built:**
- `decomposeTask(userPrompt: string): DAGNode[]` — calls Venice AI to break a natural language task into typed sub-tasks with dependency edges
- `DAGNode` type: `{ id, taskType: Capability, dependsOn: string[], assignedAgent?: AgentRecord, status, result }`
- `assignAgents(dag: DAGNode[])` — resolves each node to the cheapest registry agent matching `taskType`
- `executeDAG(dag: DAGNode[])` — runs nodes in topological order, passing upstream results as context to downstream nodes
- `handleAgentFailure(nodeId, error)` — retries with the next-cheapest agent; after 3 failures marks node as failed and halts dependent nodes
- Full execution trace must be persisted as a JSON log per task run

**Acceptance Criteria:**
- [ ] `decomposeTask` returns a valid DAG with at least 3 nodes for a multi-step prompt
- [ ] DAG execution respects topological order — no node starts before its dependencies resolve
- [ ] Agent failure triggers retry with fallback agent, not a hard crash
- [ ] Execution trace JSON is written to `logs/tasks/<taskId>.json`
- [ ] `executeDAG` returns a final merged result object when all nodes succeed
- [ ] Unit tests mock Venice AI and Registry; test DAG ordering with a 5-node fixture
- [ ] No circular dependency allowed — throw `CyclicDAGError` if detected

---

## Issue #3 — Implement Stellar Payment Layer with Escrow and Release

**Label:** `in-progress` `core` `payment` `stellar`

**Files to work on:**
```
smart-contracts/src/payment/payment.ts
```

**Background:**
Payments between agents must happen on Stellar. The flow is: Coordinator locks XLM in escrow when assigning a task to an agent; upon successful result delivery, funds are released. If the agent fails, escrowed funds are returned. Currently `payment.ts` is empty. This requires integrating the Stellar SDK and potentially a Soroban escrow contract.

**What needs to be built:**
- `lockEscrow(coordinatorKeypair, agentPublicKey, amountXLM, taskId): txHash` — creates a claimable balance or Soroban escrow entry locking funds for a specific task
- `releasePayment(coordinatorKeypair, agentPublicKey, taskId): txHash` — releases escrowed funds to agent on task success
- `refundEscrow(coordinatorKeypair, taskId): txHash` — returns funds to coordinator on task failure
- `getEscrowBalance(taskId): number` — queries current escrow state
- All transactions must be signed, submitted, and confirmed (not just built)
- Retry logic for `TIMEOUT` and `TOO_MANY_REQUESTS` Horizon errors with exponential backoff

**Acceptance Criteria:**
- [ ] `lockEscrow` creates a real claimable balance on Stellar testnet and returns the tx hash
- [ ] `releasePayment` succeeds only if called by the coordinator keypair that created the escrow
- [ ] `refundEscrow` returns exactly the locked amount minus network fees
- [ ] Duplicate `releasePayment` calls for the same `taskId` throw `EscrowAlreadySettledError`
- [ ] Exponential backoff retries up to 5 times on transient Horizon errors
- [ ] All monetary values handled as `BigInt` stroops internally, only converted to XLM strings at display layer
- [ ] Integration test demonstrates full lock → release cycle on testnet

---

## Issue #4 — Implement Venice AI Client with Streaming, Retry, and Model Routing

**Label:** `in-progress` `core` `venice` `ai-inference`

**Files to work on:**
```
smart-contracts/src/venice/venice.ts
```

**Background:**
Venice AI is the LLM inference provider powering all agent reasoning. Currently `venice.ts` is empty. Every agent (Research, Risk, Coding, Design, Report) will call Venice to generate responses. The client must handle streaming responses for long completions, route to the correct model per agent type, manage API key auth, and implement resilient retry with circuit-breaker logic so one Venice outage doesn't kill the entire network.

**What needs to be built:**
- `VeniceClient` class initialized with API key from env
- `complete(prompt, modelId, options): Promise<string>` — standard completion call
- `stream(prompt, modelId, onChunk: (chunk: string) => void): Promise<void>` — streaming completion with chunk callback
- Model routing map: `{ research: 'venice-xl', risk: 'venice-xl', coding: 'venice-code', design: 'venice-xl', report: 'venice-xl' }`
- Circuit breaker: after 3 consecutive failures, open circuit for 60s before retrying
- Request/response logging with redaction of prompt content longer than 200 chars (log truncated version)

**Acceptance Criteria:**
- [ ] `complete` returns a full string response for a simple prompt against Venice testnet/sandbox
- [ ] `stream` calls `onChunk` multiple times and resolves only after stream ends
- [ ] Circuit breaker opens after 3 failures and rejects calls immediately during open state
- [ ] Circuit breaker closes again after 60s cooldown (test with mocked timer)
- [ ] API key is read exclusively from `process.env.VENICE_API_KEY` — never hardcoded
- [ ] Model routing returns correct model string per agent type
- [ ] Unit tests cover circuit breaker state transitions: closed → open → half-open → closed

---

## Issue #5 — Implement Research Agent with Web Scraping and Source Citation

**Label:** `in-progress` `agent` `research`

**Files to work on:**
```
smart-contracts/src/agents/research/research.ts
```

**Background:**
The Research Agent is responsible for gathering factual information relevant to a task. It receives a sub-task description from the Coordinator, performs structured research (via Venice AI for synthesis and optionally web data), and returns a structured result with cited sources. Currently empty.

**What needs to be built:**
- `ResearchAgent` class implementing an `Agent` interface: `{ execute(task: SubTask): Promise<AgentResult> }`
- Agent must call `VeniceClient.complete` with a carefully engineered system prompt instructing the model to act as a research analyst
- Result must be structured: `{ summary: string, keyFindings: string[], sources: Source[], confidence: 0–1 }`
- Agent registers itself in the registry on startup with capability `'research'` and pricing
- Implements `healthCheck(): Promise<boolean>` used by the Coordinator for liveness probing
- Task results must be validated against a Zod schema before returning to Coordinator

**Acceptance Criteria:**
- [ ] `execute` returns a valid `AgentResult` conforming to the Zod schema for any non-empty prompt
- [ ] `keyFindings` array always has between 3 and 10 items
- [ ] `confidence` score is always in `[0, 1]` range
- [ ] Agent self-registers in the registry on `new ResearchAgent().start()` 
- [ ] `healthCheck` returns `false` (not throws) if Venice is unreachable
- [ ] Unit test: mock Venice, verify prompt engineering includes "cite sources" instruction
- [ ] Integration test: full execute call against Venice sandbox returns parseable JSON

---

## Issue #6 — Implement Risk Agent with Structured Risk Scoring Matrix

**Label:** `in-progress` `agent` `risk`

**Files to work on:**
```
smart-contracts/src/agents/risk/risk.ts
```

**Background:**
The Risk Agent analyzes a given domain (regulatory, financial, operational, reputational) and returns a structured risk matrix. It consumes Research Agent output as context and produces risk scores that feed into the final Report. Currently empty.

**What needs to be built:**
- `RiskAgent` class implementing the `Agent` interface
- Accepts `context: AgentResult` from Research Agent as part of its `SubTask`
- Venice prompt must be engineered to produce a JSON risk matrix: `{ risks: RiskItem[] }` where `RiskItem = { category, description, likelihood: 1–5, impact: 1–5, mitigations: string[] }`
- `overallRiskScore` computed as weighted average of `likelihood * impact` across all risk items
- Risks with `likelihood >= 4 AND impact >= 4` flagged as `critical: true`
- Result validated with Zod schema before returning

**Acceptance Criteria:**
- [ ] `execute` returns a valid risk matrix with at least 3 risk items for any substantive prompt
- [ ] `overallRiskScore` is correctly computed from the matrix (test with fixture data)
- [ ] All risks with likelihood ≥ 4 and impact ≥ 4 are marked `critical: true`
- [ ] Agent registers itself with capability `'risk'` and pricing on startup
- [ ] Zod validation rejects a response missing `mitigations` field
- [ ] Unit test mocks Venice and verifies the prompt includes research context

---

## Issue #7 — Implement Coding Agent with Code Generation, Review, and Test Scaffolding

**Label:** `in-progress` `agent` `coding` `complex`

**Files to work on:**
```
smart-contracts/src/agents/coding/coding.ts
```

**Background:**
The Coding Agent generates, reviews, or scaffolds code based on a task description. It routes to the `venice-code` model. Output must include the code itself, a language tag, and an explanation. The agent must detect the programming language from context and refuse tasks that request malicious code patterns.

**What needs to be built:**
- `CodingAgent` class implementing the `Agent` interface
- Routes exclusively to `venice-code` model via `VeniceClient`
- Output schema: `{ language: string, code: string, explanation: string, testScaffold?: string }`
- System prompt must instruct model to: follow language best practices, include inline comments, and optionally generate a test scaffold if `task.options.includeTests` is true
- Input validation: reject prompts matching a blocklist of dangerous patterns (`eval`, `exec`, `rm -rf`, `DROP TABLE`, etc.) by throwing `UnsafeCodeRequestError`
- Language detection from task description using a simple heuristic map

**Acceptance Criteria:**
- [ ] `execute` returns valid code output with non-empty `code` and `explanation` fields
- [ ] Prompts matching the dangerous pattern blocklist throw `UnsafeCodeRequestError` before calling Venice
- [ ] When `includeTests: true`, `testScaffold` field is present and non-empty
- [ ] `language` field matches detected language from task description in ≥ 80% of unit test fixtures
- [ ] Agent registers with capability `'coding'` on startup
- [ ] Unit tests cover: normal code gen, blocklist rejection, test scaffold generation

---

## Issue #8 — Implement Report Agent with Multi-Section Document Assembly

**Label:** `in-progress` `agent` `report`

**Files to work on:**
```
smart-contracts/src/agents/report/report.ts
```

**Background:**
The Report Agent is the final node in the DAG. It receives results from Research and Risk agents (and optionally Coding/Design) and assembles a coherent, multi-section document in Markdown. This is the artifact delivered to the end user. Currently empty.

**What needs to be built:**
- `ReportAgent` class implementing the `Agent` interface
- Accepts `upstreamResults: AgentResult[]` as part of the `SubTask` context
- Calls Venice to synthesize a structured Markdown report with mandatory sections: Executive Summary, Findings, Risk Analysis, Recommendations, Conclusion
- Output schema: `{ title: string, sections: Section[], wordCount: number, generatedAt: ISO8601 }`
- Section schema: `{ heading: string, content: string, sourceAgents: string[] }`
- Report must include attribution of which upstream agent contributed to each section
- `wordCount` must be computed accurately (split on whitespace)

**Acceptance Criteria:**
- [ ] `execute` returns a valid report with all 5 mandatory sections present
- [ ] `wordCount` matches actual word count of concatenated section content (±5 words tolerance for edge cases)
- [ ] Each section's `sourceAgents` array references at least one valid upstream agent name
- [ ] Report fails with `InsufficientContextError` if no upstream results are provided
- [ ] Agent registers with capability `'report'` on startup
- [ ] Unit test: fixture with mocked Research + Risk results produces deterministic section structure

---

## Issue #9 — Add End-to-End Integration Test: Full Market Report Pipeline on Testnet

**Label:** `in-progress` `testing` `integration` `e2e`

**Files to work on:**
```
smart-contracts/tests/e2e/market-report.test.ts
```

**Background:**
No end-to-end test exists that exercises the full ai-net pipeline: user submits a task → Coordinator decomposes → agents execute → payments flow → report generated. This is the most critical test in the repo. It must run against Stellar testnet and Venice sandbox, and pass in CI.

**What needs to be built:**
- E2E test file `tests/e2e/market-report.test.ts` using Jest
- Test setup: fund two testnet accounts (coordinator + agent pool) using Friendbot
- Submit prompt: `"Generate a market-entry report for solar energy in Southeast Asia"`
- Assert each DAG node completes in sequence
- Assert payment transactions appear on Stellar testnet for each completed agent task (verify via Horizon API)
- Assert final report has all mandatory sections
- Full test timeout: 120s (Venice calls are slow)
- CI env vars needed: `STELLAR_COORDINATOR_SECRET`, `VENICE_API_KEY` — document in `.env.example`

**Acceptance Criteria:**
- [ ] Test passes end-to-end on Stellar testnet without manual intervention
- [ ] Horizon API confirms at least 3 payment transactions per full pipeline run
- [ ] Final `AgentResult` from Report Agent passes Zod schema validation
- [ ] Test cleans up (deregisters agents) in `afterAll`
- [ ] Test runtime documented in test file comments (expected: 60–120s)
- [ ] `.env.example` updated with all required CI variables
- [ ] README updated with instructions to run E2E tests

---

## Issue #10 — Design Agent: Implement UI/UX Wireframe Description Generator with Asset Manifest

**Label:** `in-progress` `agent` `design`

**Files to work on:**
```
smart-contracts/src/agents/design/design.ts
```

**Background:**
The Design Agent takes a product or feature description and produces structured UI/UX guidance: wireframe descriptions, color palette, component hierarchy, and an asset manifest. This output feeds into the frontend build process and helps human designers bootstrap quickly. Currently empty.

**What needs to be built:**
- `DesignAgent` class implementing the `Agent` interface
- Venice prompt engineered for UI/UX output: system prompt instructs model to think as a senior product designer
- Output schema: `{ wireframes: WireframeSection[], colorPalette: ColorToken[], componentHierarchy: ComponentNode[], assetManifest: AssetEntry[] }`
- `WireframeSection`: `{ name, description, layout: 'grid' | 'flex' | 'absolute', elements: UIElement[] }`
- `ColorToken`: `{ name, hex, usage }`
- `AssetEntry`: `{ name, type: 'icon' | 'image' | 'font', description, suggestedSource }`
- All output validated with Zod schema
- Agent registers with capability `'design'` on startup

**Acceptance Criteria:**
- [ ] `execute` returns a valid design output with at least 2 wireframe sections
- [ ] `colorPalette` has between 4 and 12 tokens
- [ ] All `hex` values in `colorPalette` pass a hex color regex validation
- [ ] `componentHierarchy` is a valid tree (no circular parent references)
- [ ] `assetManifest` has at least 1 entry of type `'icon'`
- [ ] Agent registers with capability `'design'` on startup
- [ ] Unit test: mock Venice, verify output passes full Zod schema validation
- [ ] Integration test: real Venice call returns parseable design output
