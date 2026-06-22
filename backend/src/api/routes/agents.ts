import { Router, Request, Response } from "express";
import { z } from "zod";

export interface AgentRecord {
  id: string;
  capability: string;
  priceXLM: number;
  endpoint: string;
  status: string;
}

export interface AgentsRouterOptions {
  initialAgents?: AgentRecord[];
  healthTimeoutMs?: number;
}

const DEFAULT_HEALTH_TIMEOUT_MS = 3_000;

const RegisterAgentSchema = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  priceXLM: z.number().finite(),
  endpoint: z.string().url(),
  status: z.string().min(1).optional(),
});

const registryCache = new Map<string, AgentRecord>();

export function createAgentsRouter(options: AgentsRouterOptions = {}): Router {
  const router = Router();
  const agents = options.initialAgents ? new Map(options.initialAgents.map(agent => [agent.id, agent])) : registryCache;
  const healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;

  router.get("/", (_req: Request, res: Response): void => {
    res.status(200).json(Array.from(agents.values()));
  });

  router.get("/:id", (req: Request, res: Response): void => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.status(200).json(agent);
  });

  router.get("/:id/health", async (req: Request, res: Response): Promise<void> => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), healthTimeoutMs);

    try {
      const response = await fetch(agent.endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      res.status(200).json({
        status: response.ok ? "healthy" : "unreachable",
        latencyMs: Date.now() - startedAt,
      });
    } catch {
      res.status(200).json({
        status: "unreachable",
        latencyMs: Date.now() - startedAt,
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  router.post("/", (req: Request, res: Response): void => {
    const parse = RegisterAgentSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const agent: AgentRecord = {
      ...parse.data,
      status: parse.data.status ?? "registered",
    };

    agents.set(agent.id, agent);
    res.status(201).json(agent);
  });

  return router;
}

export const agentsRouter = createAgentsRouter();
