import { Router, Request, Response } from "express";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getAgentDb, createAgentDb } from "../../db/agents";

export const agentsRouter = Router();

const RegisterAgentSchema = z.object({
  agentId: z.string(),
  capabilities: z.array(z.string()),
  pricingXLM: z.number(),
  endpoint: z.string().url(),
  stellarPublicKey: z.string()
});

const horizon = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

// GET /api/agents
agentsRouter.get("/", (req: Request, res: Response): void => {
  const db = createAgentDb(getAgentDb());
  const capability = req.query.capability as string | undefined;
  const minReputation = req.query.minReputation ? parseFloat(req.query.minReputation as string) : undefined;
  const maxPriceXLM = req.query.maxPriceXLM ? parseFloat(req.query.maxPriceXLM as string) : undefined;
  
  try {
    const agents = db.list({ capability, minReputation, maxPriceXLM });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/agents/:id
agentsRouter.get("/:id", (req: Request, res: Response): void => {
  const db = createAgentDb(getAgentDb());
  const agent = db.findById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

// POST /api/agents/register
agentsRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  const parse = RegisterAgentSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  
  const data = parse.data;
  
  // Verify Stellar account exists
  try {
    await horizon.loadAccount(data.stellarPublicKey);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      res.status(400).json({ error: "StellarAccountNotFound" });
      return;
    }
    res.status(400).json({ error: "Failed to verify Stellar account", details: err.message });
    return;
  }
  
  const db = createAgentDb(getAgentDb());
  const agent = {
    id: data.agentId,
    capabilities: data.capabilities,
    pricingXLM: data.pricingXLM,
    endpoint: data.endpoint,
    stellarPublicKey: data.stellarPublicKey,
    reputationScore: 0,
    lastSeenAt: new Date().toISOString()
  };
  
  db.upsert(agent);
  
  res.status(201).json(agent);
});

// DELETE /api/agents/:id
agentsRouter.delete("/:id", (req: Request, res: Response): void => {
  const db = createAgentDb(getAgentDb());
  const agent = db.findById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  
  const signature = req.headers["x-signature"] as string;
  const challenge = req.headers["x-challenge"] as string;
  
  if (!signature || !challenge) {
    res.status(401).json({ error: "Missing challenge or signature" });
    return;
  }
  
  try {
    const keypair = StellarSdk.Keypair.fromPublicKey(agent.stellarPublicKey);
    const isValid = keypair.verify(Buffer.from(challenge), Buffer.from(signature, "base64"));
    if (!isValid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: "Invalid signature format" });
    return;
  }
  
  db.delete(req.params.id);
  res.json({ message: "Agent deleted successfully" });
});
