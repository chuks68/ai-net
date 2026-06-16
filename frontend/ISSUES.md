# Frontend — Open Issues

> ⭐ **Please star the repository before contributing!** It shows your support and helps maintainers prioritize active contributors.
> [github.com/YOUR_ORG/ai-net](https://github.com/YOUR_ORG/ai-net) → click **Star** in the top right.

These are active, in-progress issues for the `frontend` of ai-net — a React/TypeScript web application for submitting tasks, monitoring agent execution, viewing DAG progress, and managing Stellar wallet interactions. All source directories are empty and awaiting implementation.

Comment on the GitHub issue to claim it before opening a PR. Include your planned approach in the comment.

---

## Issue #11 — Scaffold React App with Routing, Auth Context, and Stellar Wallet Provider

**Label:** `in-progress` `frontend` `core` `setup`

**Files to work on:**
```
frontend/src/pages/
frontend/src/context/
frontend/src/types/
frontend/src/styles/
```

**Background:**
The entire frontend is empty. Before any feature can be built, the app skeleton must exist: a React + TypeScript app (Vite), a client-side router, a global auth/wallet context that holds the connected Stellar keypair, and a base design system (Tailwind or CSS modules). This is the foundational issue — most other frontend issues depend on it.

**What needs to be built:**
- Vite + React 18 + TypeScript project initialized in `frontend/`
- React Router v6 with routes: `/` (landing), `/dashboard`, `/tasks/new`, `/tasks/:id`, `/agents`, `/wallet`
- `WalletContext` in `frontend/src/context/WalletContext.tsx`: holds `{ publicKey, keypair, connected, connect(), disconnect() }`
- `connect()` accepts a secret key input (testnet only) and validates it with Stellar SDK before storing in context
- Global error boundary component in `frontend/src/components/common/ErrorBoundary.tsx`
- Base CSS/Tailwind config with design tokens matching the dark-mode dashboard aesthetic described in Issue #20
- TypeScript path aliases configured: `@components`, `@pages`, `@hooks`, `@services`, `@types`

**Acceptance Criteria:**
- [ ] `npm run dev` starts the app with all routes navigable
- [ ] `WalletContext` throws `InvalidKeypairError` (not crashes) if an invalid secret is provided
- [ ] `useWallet()` hook re-renders consumers when connect/disconnect is called
- [ ] `ErrorBoundary` catches render errors and shows a fallback UI with an error code
- [ ] All TypeScript path aliases resolve without error in `tsconfig.json` and `vite.config.ts`
- [ ] Lighthouse accessibility score ≥ 90 on the landing page
- [ ] No `any` types used in context or hook implementations

---

## Issue #12 — Build Task Submission Form with DAG Preview and Validation

**Label:** `in-progress` `frontend` `feature` `complex`

**Files to work on:**
```
frontend/src/pages/
frontend/src/components/agents/
frontend/src/hooks/
frontend/src/services/
```

**Background:**
Users submit natural language tasks to the Coordinator via the frontend. The submission form must accept a task prompt, validate it, send it to the backend API, and immediately render a preview of the expected DAG structure before execution begins. This is the primary user-facing interaction surface.

**What needs to be built:**
- `TaskSubmissionForm` component in `frontend/src/pages/` (route: `/tasks/new`)
- Form fields: `prompt` (textarea, max 1000 chars), `maxBudgetXLM` (number input, min 0.1), `agentPreferences` (multi-select checkboxes for agent types)
- Client-side validation with `react-hook-form` + `zod` resolver
- `useTaskSubmit` hook in `frontend/src/hooks/` that POSTs to `POST /api/tasks` and returns `{ taskId, dagPreview, status }`
- `DAGPreview` component renders the returned DAG as a visual node graph using `react-flow` (nodes = agent tasks, edges = dependencies)
- On successful submission, redirect to `/tasks/:taskId` (the live monitoring page, Issue #13)
- Loading state: skeleton loader while DAG preview is computed
- Error state: inline form errors + toast notification for API errors

**Acceptance Criteria:**
- [ ] Form submission with an empty prompt shows a validation error without making an API call
- [ ] `maxBudgetXLM` below 0.1 shows a validation error
- [ ] `DAGPreview` renders nodes with correct agent labels and dependency edges
- [ ] Successful submission redirects to `/tasks/:taskId` within 500ms of API response
- [ ] Network error displays a dismissible toast with the error message
- [ ] Form is keyboard-navigable and all inputs have associated `<label>` elements
- [ ] `useTaskSubmit` hook is unit-tested with mocked fetch (success + error cases)

---

## Issue #13 — Real-Time Task Monitoring Page with WebSocket DAG Status Updates

**Label:** `in-progress` `frontend` `feature` `websocket` `complex`

**Files to work on:**
```
frontend/src/pages/
frontend/src/hooks/
frontend/src/components/dashboard/
frontend/src/types/
```

**Background:**
After submitting a task, users need to watch agent execution in real time. Each DAG node transitions through states: `pending → running → completed | failed`. The monitoring page must subscribe to a WebSocket connection per task, animate node state transitions on the DAG graph, show agent output previews as they arrive, and display live payment events (escrow lock → release).

**What needs to be built:**
- `TaskDetailPage` at route `/tasks/:id`
- `useTaskMonitor(taskId)` hook: opens a WebSocket to `ws://localhost:3001/tasks/:id/stream`, parses incoming `DAGEvent` messages, updates local `dagState`
- `DAGEvent` types: `{ type: 'node_started' | 'node_completed' | 'node_failed' | 'payment_locked' | 'payment_released', nodeId, payload }`
- Live DAG graph using `react-flow` with animated edges for running nodes and color-coded node states (grey/blue/green/red)
- `AgentOutputPanel`: collapsible panel showing streamed output text per node as it arrives
- `PaymentTimeline` component: ordered list of payment events with amounts and Stellar tx hashes (linked to Stellar Explorer)
- Reconnect logic: if WebSocket drops, retry with exponential backoff up to 5 attempts

**Acceptance Criteria:**
- [ ] DAG node colors update within 200ms of receiving a `node_started` WebSocket event
- [ ] `AgentOutputPanel` appends text chunks in order without layout shift
- [ ] `PaymentTimeline` shows correct XLM amounts from `payment_locked`/`payment_released` events
- [ ] WebSocket reconnect is attempted after disconnect (test by mocking WebSocket close event)
- [ ] Page shows a "Task Failed" banner with failed node details if any node reaches `failed` state
- [ ] Stellar tx hash links open `https://stellar.expert/explorer/testnet/tx/:hash` in a new tab
- [ ] `useTaskMonitor` hook cleans up WebSocket connection on component unmount

---

## Issue #14 — Agent Registry Browser with Live Capability Filter and Pricing Table

**Label:** `in-progress` `frontend` `feature`

**Files to work on:**
```
frontend/src/pages/
frontend/src/components/agents/
frontend/src/services/
frontend/src/hooks/
```

**Background:**
Developers and users need visibility into which agents are registered on-chain, their capabilities, current pricing, and reputation scores. The `/agents` page is the agent marketplace browser. It fetches registry data from the backend API and renders a filterable, sortable table.

**What needs to be built:**
- `AgentsPage` at route `/agents`
- `useAgentRegistry()` hook: fetches `GET /api/agents` and returns `{ agents, loading, error, refetch }`
- `AgentTable` component: columns: Agent ID (truncated), Capabilities (pill badges), Price (XLM), Reputation (0–5 stars), Status (active/inactive), Actions
- Filter bar: filter by capability (multi-select), price range (slider), status toggle
- Sort: by price (asc/desc), by reputation (desc)
- `AgentDetailModal`: click a row to open a modal with full agent metadata, endpoint, registration tx hash
- Auto-refresh every 30s via `useInterval` hook
- Empty state: "No agents registered yet" with a link to the contribution guide

**Acceptance Criteria:**
- [ ] Table renders all agents returned by `GET /api/agents`
- [ ] Capability filter correctly hides agents not matching selected capabilities
- [ ] Price range slider filters agents in real time (no API call, client-side)
- [ ] `AgentDetailModal` shows registration tx hash linked to Stellar Explorer
- [ ] Auto-refresh updates the table without remounting components (no flash)
- [ ] Loading state shows a table skeleton with 5 placeholder rows
- [ ] Empty state renders correctly when API returns an empty array
- [ ] All filter/sort state is reflected in the URL query string (sharable links)

---

## Issue #15 — Stellar Wallet Page with Balance, Transaction History, and XLM Send Form

**Label:** `in-progress` `frontend` `wallet` `stellar`

**Files to work on:**
```
frontend/src/pages/
frontend/src/components/wallet/
frontend/src/services/
frontend/src/hooks/
```

**Background:**
The wallet page gives users visibility into their Stellar account: current XLM balance, recent transactions (payments in/out to agents), and a form to manually send XLM. This page uses the Stellar Horizon API directly from the browser for balance and history, and the `WalletContext` for the connected keypair.

**What needs to be built:**
- `WalletPage` at route `/wallet`
- `useWalletBalance(publicKey)` hook: polls Horizon `GET /accounts/:id` every 10s for XLM balance
- `useTransactionHistory(publicKey)` hook: fetches last 20 transactions from Horizon, parses payment operations, returns `{ amount, direction: 'in'|'out', counterparty, memo, timestamp, txHash }[]`
- `SendXLMForm`: destination address, amount, optional memo; builds, signs, and submits a Stellar payment transaction using the keypair from `WalletContext`; shows confirmation dialog before submitting
- `TransactionTable`: renders transaction history with amount color-coded (green for in, red for out) and Stellar Explorer links
- QR code display of own public key using `qrcode.react`

**Acceptance Criteria:**
- [ ] Balance updates within 10s of a payment being confirmed on testnet
- [ ] `SendXLMForm` shows a confirmation modal with destination and amount before signing
- [ ] Sending to an invalid Stellar address shows an inline validation error (no API call made)
- [ ] Sending more than available balance shows an error (checked client-side before submission)
- [ ] Transaction history renders correctly for accounts with 0 transactions (empty state)
- [ ] QR code renders the correct public key (verify by decoding in a unit test)
- [ ] `SendXLMForm` clears after successful submission and shows a success toast with tx hash

---

## Issue #16 — Build Dashboard Homepage with KPI Cards, Recent Tasks, and Network Stats

**Label:** `in-progress` `frontend` `dashboard`

**Files to work on:**
```
frontend/src/pages/
frontend/src/components/dashboard/
frontend/src/hooks/
frontend/src/services/
```

**Background:**
The `/dashboard` route is the first page authenticated users see. It must give a high-level overview of the network: total agents registered, total tasks run, total XLM transacted, user's own task history, and a network health indicator. Data is fetched from the backend REST API.

**What needs to be built:**
- `DashboardPage` at route `/dashboard`
- `useNetworkStats()` hook: fetches `GET /api/stats` returning `{ totalAgents, totalTasks, totalXLMTransacted, uptimePercent }`
- KPI Cards (4 cards): Total Agents, Total Tasks Run, Total XLM Transacted, Network Uptime — each with a sparkline trend chart using `recharts`
- `RecentTasksTable`: last 5 tasks submitted by the connected wallet, with status badges and a "View" link
- `NetworkHealthBadge`: green/yellow/red dot + label based on `uptimePercent` thresholds (≥ 99% green, ≥ 95% yellow, < 95% red)
- Skeleton loaders for all async sections
- Dashboard is only accessible when wallet is connected — redirect to `/` if not connected

**Acceptance Criteria:**
- [ ] All 4 KPI cards render with correct values from `GET /api/stats`
- [ ] Sparkline charts render without throwing (even with a single data point)
- [ ] `NetworkHealthBadge` shows correct color for each threshold (unit test with fixture values)
- [ ] Unauthenticated access to `/dashboard` redirects to `/`
- [ ] `RecentTasksTable` shows "No tasks yet" empty state for new wallets
- [ ] Dashboard re-fetches stats on window focus event
- [ ] All loading states use skeleton components (not spinners) for better perceived performance

---

## Issue #17 — Implement Global API Service Layer with Typed Responses and Error Handling

**Label:** `in-progress` `frontend` `services` `types`

**Files to work on:**
```
frontend/src/services/
frontend/src/types/
frontend/src/utils/
```

**Background:**
Multiple components and hooks need to call the backend REST API. Without a centralized service layer, each component duplicates fetch logic, error handling, and type assertions. This issue builds the shared API client used by all hooks.

**What needs to be built:**
- `apiClient` in `frontend/src/services/api.ts`: a typed `fetch` wrapper with base URL from `VITE_API_BASE_URL` env var
- Methods: `get<T>(path): Promise<T>`, `post<T>(path, body): Promise<T>`, `delete<T>(path): Promise<T>`
- All API responses typed with interfaces in `frontend/src/types/api.ts`: `TaskResponse`, `AgentRecord`, `NetworkStats`, `DAGNode`, `PaymentEvent`
- Error handling: non-2xx responses throw `ApiError` with `{ statusCode, message, path }` — never raw `Response` objects
- Request interceptor: attaches `Authorization: Bearer <walletPublicKey>` header when wallet is connected
- Response interceptor: handles `401` by dispatching a `wallet_disconnected` event to `WalletContext`
- Retry on `503` (service unavailable) up to 3 times with exponential backoff

**Acceptance Criteria:**
- [ ] `get<AgentRecord[]>('/api/agents')` returns typed data without casting anywhere at call site
- [ ] `ApiError` is thrown (not a generic `Error`) for 4xx and 5xx responses
- [ ] `Authorization` header is present in all requests when wallet is connected (verify in unit test by inspecting fetch mock)
- [ ] `401` response triggers `wallet_disconnected` event (test with custom event listener mock)
- [ ] `503` triggers exactly 3 retry attempts before throwing
- [ ] All types in `frontend/src/types/api.ts` match the backend response schemas exactly
- [ ] No `any` type used anywhere in `services/` or `types/`

---

## Issue #18 — Implement Agent Output Renderer with Markdown, Code Highlighting, and Risk Matrix Visualization

**Label:** `in-progress` `frontend` `components` `complex`

**Files to work on:**
```
frontend/src/components/agents/
frontend/src/utils/
```

**Background:**
Different agents produce different output formats: Research returns Markdown prose, Risk returns a structured matrix, Coding returns fenced code blocks, Report returns a full Markdown document. A generic renderer cannot handle all these well. This issue builds a smart `AgentOutputRenderer` that detects output type and renders appropriately.

**What needs to be built:**
- `AgentOutputRenderer` component: `{ agentType: Capability, result: AgentResult }` props
- For `research` and `report`: render Markdown using `react-markdown` with `remark-gfm`
- For `coding`: render with `react-syntax-highlighter` (Prism, `vscode-dark` theme), with a copy-to-clipboard button
- For `risk`: render a custom `RiskMatrix` component — a 5×5 likelihood/impact heatmap grid with risks plotted as dots, color-coded by severity (green/yellow/orange/red)
- For `design`: render color palette swatches + component hierarchy as a collapsible tree
- `RiskMatrix` component: SVG-based 5×5 grid; tooltip on hover showing risk description and mitigations
- All renderers must handle `null`/`undefined` result gracefully with an empty-state placeholder

**Acceptance Criteria:**
- [ ] `research` output renders Markdown headers, bold, lists correctly
- [ ] `coding` output shows syntax-highlighted code with a functional copy button (test clipboard API mock)
- [ ] `RiskMatrix` renders all risk items in their correct cell (unit test with 5 fixture risks at known positions)
- [ ] `RiskMatrix` tooltip appears on hover and shows `description` and `mitigations[0]`
- [ ] `design` output renders at least the color palette swatches with correct hex values
- [ ] `AgentOutputRenderer` with `result = null` shows placeholder without throwing
- [ ] Lighthouse performance score ≥ 85 on a page rendering all 5 agent output types simultaneously

---

## Issue #19 — Build Responsive Layout System with Navigation, Sidebar, and Mobile Drawer

**Label:** `in-progress` `frontend` `layout` `accessibility`

**Files to work on:**
```
frontend/src/components/layout/
frontend/src/styles/
```

**Background:**
The app needs a consistent shell layout: top navigation bar, collapsible sidebar for desktop, and a bottom-sheet drawer for mobile. Currently no layout components exist. All pages currently render without any chrome.

**What needs to be built:**
- `AppShell` layout component in `frontend/src/components/layout/AppShell.tsx`: wraps all authenticated pages
- `Sidebar` component: links to Dashboard, New Task, Agents, Wallet; collapsible to icon-only mode; persists collapsed state in `localStorage`
- `TopNav` component: shows logo, current route title, wallet connection status chip (public key truncated to `GABC...XYZ`), disconnect button
- Mobile breakpoint (< 768px): sidebar replaced with hamburger → bottom drawer overlay using `framer-motion`
- `Breadcrumb` component: dynamic breadcrumbs from React Router location
- All components fully keyboard-navigable: `Tab` through nav items, `Escape` closes drawer
- ARIA roles: `role="navigation"`, `aria-current="page"` on active link, `aria-expanded` on sidebar toggle

**Acceptance Criteria:**
- [ ] `AppShell` wraps all authenticated routes and renders sidebar + top nav
- [ ] Sidebar collapse state persists across page refreshes (`localStorage` key: `sidebar_collapsed`)
- [ ] Mobile drawer opens on hamburger click and closes on `Escape` or backdrop click
- [ ] `aria-current="page"` is applied to the active nav link (unit test with React Router mock)
- [ ] `TopNav` renders truncated public key in format `GABC...XYZ` for keys of any length
- [ ] No horizontal scroll at any viewport width from 320px to 1920px
- [ ] Axe accessibility audit: zero critical violations on all layout components

---

## Issue #20 — Implement End-to-End Frontend Integration Tests with Playwright

**Label:** `in-progress` `frontend` `testing` `e2e` `complex`

**Files to work on:**
```
frontend/tests/e2e/
frontend/playwright.config.ts
```

**Background:**
No end-to-end tests exist for the frontend. Playwright tests must cover the critical user journeys: wallet connect → submit task → monitor execution → view report. Tests must run against a locally running backend (or a mock server) in CI.

**What needs to be built:**
- `playwright.config.ts` at `frontend/` root — configure browser targets (Chromium, Firefox), base URL, and screenshot on failure
- `frontend/tests/e2e/wallet.spec.ts`: test wallet connect flow with a valid testnet secret key; assert public key appears in top nav
- `frontend/tests/e2e/task-submission.spec.ts`: fill and submit task form; assert redirect to `/tasks/:id` and DAG preview renders
- `frontend/tests/e2e/agent-registry.spec.ts`: navigate to `/agents`, assert table renders with at least 1 row (against mock API)
- `frontend/tests/e2e/task-monitoring.spec.ts`: mock WebSocket server; assert DAG node color changes on `node_completed` event
- Mock service worker (`msw`) setup for API mocking in tests so no real backend is required
- Playwright HTML report generated on each CI run

**Acceptance Criteria:**
- [ ] All E2E specs pass in Chromium and Firefox headless
- [ ] Wallet connect test fails correctly when an invalid secret key is entered (error message visible)
- [ ] Task submission test asserts the DAG preview contains at least 3 nodes
- [ ] WebSocket mock triggers a `node_completed` event and the test asserts the node turns green
- [ ] `npm run test:e2e` runs all Playwright specs and exits non-zero on any failure
- [ ] CI config (GitHub Actions or equivalent) runs E2E tests on every PR
- [ ] Screenshots are captured on test failure and saved as CI artifacts
