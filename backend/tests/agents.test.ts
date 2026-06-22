import express from "express";
import type { AddressInfo } from "net";
import request from "supertest";
import { createApp } from "../src/api";
import { createAgentsRouter, type AgentRecord } from "../src/api/routes/agents";

const codingAgent: AgentRecord = {
  id: "coding-1",
  capability: "coding",
  priceXLM: 2.5,
  endpoint: "http://127.0.0.1:3001/health",
  status: "online",
};

function createTestApp(initialAgents: AgentRecord[] = [], healthTimeoutMs = 500) {
  const app = express();
  app.use(express.json());
  app.use("/api/agents", createAgentsRouter({ initialAgents, healthTimeoutMs }));
  return app;
}

function listen(app: express.Express) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

describe("Agents API route", () => {
  it("returns 200 with an empty array when no agents are registered", async () => {
    const response = await request(createApp()).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns all agents from the local registry cache", async () => {
    const response = await request(createTestApp([codingAgent])).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([codingAgent]);
  });

  it("returns a single agent by id", async () => {
    const response = await request(createTestApp([codingAgent])).get("/api/agents/coding-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(codingAgent);
  });

  it("returns 404 for an unknown agent id", async () => {
    const response = await request(createTestApp()).get("/api/agents/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Agent not found" });
  });

  it("registers an agent in the local cache", async () => {
    const app = createTestApp();
    const agent = {
      id: "research-1",
      capability: "research",
      priceXLM: 1.75,
      endpoint: "http://127.0.0.1:3002/health",
      status: "idle",
    };

    const createResponse = await request(app).post("/api/agents").send(agent);
    const listResponse = await request(app).get("/api/agents");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(agent);
    expect(listResponse.body).toEqual([agent]);
  });

  it("defaults registered agent status when it is omitted", async () => {
    const response = await request(createTestApp()).post("/api/agents").send({
      id: "risk-1",
      capability: "risk",
      priceXLM: 3,
      endpoint: "http://127.0.0.1:3003/health",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "risk-1", status: "registered" });
  });

  it("rejects invalid agent registration payloads", async () => {
    const response = await request(createTestApp()).post("/api/agents").send({
      id: "broken-1",
      capability: "coding",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors).toHaveProperty("priceXLM");
    expect(response.body.error.fieldErrors).toHaveProperty("endpoint");
  });

  it("returns healthy status and latency for a reachable agent endpoint", async () => {
    const healthApp = express();
    healthApp.get("/health", (_req, res) => res.status(200).json({ ok: true }));
    const healthServer = listen(healthApp);

    try {
      const response = await request(createTestApp([{
        ...codingAgent,
        endpoint: `${healthServer.url}/health`,
      }])).get("/api/agents/coding-1/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.latencyMs).toEqual(expect.any(Number));
    } finally {
      healthServer.server.close();
    }
  });

  it("returns unreachable status when an agent endpoint times out", async () => {
    const slowApp = express();
    slowApp.get("/health", (_req, res) => {
      setTimeout(() => res.status(200).json({ ok: true }), 100);
    });
    const slowServer = listen(slowApp);

    try {
      const response = await request(createTestApp([{
        ...codingAgent,
        endpoint: `${slowServer.url}/health`,
      }], 10)).get("/api/agents/coding-1/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("unreachable");
      expect(response.body.latencyMs).toEqual(expect.any(Number));
    } finally {
      slowServer.server.close();
    }
  });

  it("returns 404 when checking health for an unknown agent", async () => {
    const response = await request(createTestApp()).get("/api/agents/missing/health");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Agent not found" });
  });
});
