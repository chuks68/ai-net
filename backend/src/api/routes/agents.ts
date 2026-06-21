/**
 * Agent registration and discovery API routes.
 */

import { Router, Request, Response } from 'express';

interface RegisteredAgent {
  agentId: string;
  capabilities: string[];
  pricingXLM: number;
  endpoint: string;
  stellarPublicKey: string;
  registeredAt: string;
}

// In-memory registry for development
const agentRegistry: Map<string, RegisteredAgent> = new Map();

export function createAgentsRouter(): Router {
  const router = Router();

  // POST /api/agents/register - Register an agent
  router.post('/register', (req: Request, res: Response) => {
    const { agentId, capabilities, pricingXLM, endpoint, stellarPublicKey } = req.body;

    if (!agentId || !capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
      return res.status(400).json({ error: 'agentId and capabilities array are required' });
    }

    const agent: RegisteredAgent = {
      agentId,
      capabilities,
      pricingXLM: pricingXLM ?? 0.5,
      endpoint: endpoint ?? '',
      stellarPublicKey: stellarPublicKey ?? '',
      registeredAt: new Date().toISOString(),
    };

    agentRegistry.set(agentId, agent);

    return res.status(201).json({
      message: 'Agent registered successfully',
      agent,
    });
  });

  // GET /api/agents - List all registered agents
  router.get('/', (req: Request, res: Response) => {
    const agents = Array.from(agentRegistry.values());
    return res.json({
      agents,
      count: agents.length,
    });
  });

  // GET /api/agents/:capability - Discover agents by capability
  router.get('/capability/:capability', (req: Request, res: Response) => {
    const { capability } = req.params;
    const agents = Array.from(agentRegistry.values())
      .filter(agent => agent.capabilities.includes(capability));
    
    return res.json({
      capability,
      agents,
      count: agents.length,
    });
  });

  return router;
}
