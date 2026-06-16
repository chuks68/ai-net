# Architecture

## Overview

ai-net is composed of four layers:

1. **Registry** — agent discovery (in-memory now, Soroban on-chain next)
2. **Coordinator** — task decomposition and agent orchestration
3. **Agents** — specialized workers (Research, Risk, Coding, Design, Report)
4. **Payment** — Stellar XLM payments between agents

## Data Flow

```
User Task
    │
    ▼
CoordinatorAgent.run(task)
    │
    ├── discoverAgents('research') → ResearchAgent.run(task)
    ├── discoverAgents('risk')     → RiskAgent.run(task)
    └── discoverAgents('report')  → ReportAgent.run({ task, research, risk })
                                        │
                                        ▼
                                  pay() for each agent
                                        │
                                        ▼
                                  Final Report
```

## Extending

To add a new agent type:
1. Create `src/agents/<type>/<type>.ts` with a class that has `run(task): Promise<string>`.
2. Register it in `src/coordinator/coordinator.ts`.
3. Add a discovery and call step in `CoordinatorAgent.run()`.
