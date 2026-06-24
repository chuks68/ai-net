import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../src/api";
import { getTaskDb, closeTaskDb, createTaskDb } from "../src/db/tasks";

// Use in-memory SQLite for tests by monkey-patching getTaskDb
let inMemoryDb: Database.Database;

beforeAll(() => {
  inMemoryDb = new Database(":memory:");
  inMemoryDb.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      prompt          TEXT NOT NULL,
      walletPublicKey TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'queued',
      dagJson         TEXT NOT NULL DEFAULT '[]',
      createdAt       TEXT NOT NULL,
      updatedAt       TEXT NOT NULL
    )
  `);
  // Override getTaskDb to return the in-memory db
  jest.spyOn(require("../src/db/tasks"), "getTaskDb").mockReturnValue(inMemoryDb);
});

afterAll(() => {
  inMemoryDb.close();
  jest.restoreAllMocks();
});

const app = createApp();
const WALLET = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGDG6NXGPTVMLHK4HZ7HHN";

describe("POST /api/tasks", () => {
  it("returns 201 with taskId and DAG with >= 1 node for valid prompt", async () => {
    const res = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "Generate a market entry report for solar energy", maxBudgetXLM: 1 });

    expect(res.status).toBe(201);
    expect(res.body.taskId).toMatch(/^task_/);
    expect(Array.isArray(res.body.dagPreview)).toBe(true);
    expect(res.body.dagPreview.length).toBeGreaterThanOrEqual(1);
    expect(res.body.status).toBe("queued");
  });

  it("returns 400 when maxBudgetXLM < 0.1", async () => {
    const res = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "do something", maxBudgetXLM: 0.05 });

    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await request(app.httpServer)
      .post("/api/tasks")
      .send({ maxBudgetXLM: 1 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns 404 for unknown ID", async () => {
    const res = await request(app.httpServer).get("/api/tasks/task_doesnotexist");
    expect(res.status).toBe(404);
  });

  it("returns task for known ID", async () => {
    const create = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "Research AI trends", maxBudgetXLM: 2 });

    const id = create.body.taskId;
    const res = await request(app.httpServer).get(`/api/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(Array.isArray(res.body.dag)).toBe(true);
  });
});

describe("GET /api/tasks (pagination)", () => {
  it("returns paginated results", async () => {
    // Create 3 tasks for a fresh wallet
    const wallet = "GCEZWKCA5PAGINATE000000000000000000000000000000000000000000";
    for (let i = 0; i < 3; i++) {
      await request(app.httpServer)
        .post("/api/tasks")
        .set("walletpublickey", wallet)
        .send({ prompt: `Task number ${i}`, maxBudgetXLM: 1 });
    }

    const res = await request(app.httpServer)
      .get("/api/tasks?page=1&pageSize=2")
      .set("walletpublickey", wallet);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("cancels a queued task", async () => {
    const create = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "Cancel me", maxBudgetXLM: 1 });
    const id = create.body.taskId;

    const res = await request(app.httpServer).delete(`/api/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("returns 409 when task is running", async () => {
    const create = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "Running task", maxBudgetXLM: 1 });
    const id = create.body.taskId;

    // Manually set to running via DB
    createTaskDb(inMemoryDb).updateStatus(id, "running");

    const res = await request(app.httpServer).delete(`/api/tasks/${id}`);
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown task", async () => {
    const res = await request(app.httpServer).delete("/api/tasks/task_unknown999");
    expect(res.status).toBe(404);
  });
});

describe("SQLite persistence", () => {
  it("task survives a simulated restart (same DB instance)", async () => {
    const create = await request(app.httpServer)
      .post("/api/tasks")
      .set("walletpublickey", WALLET)
      .send({ prompt: "Persist me", maxBudgetXLM: 1 });
    const id = create.body.taskId;

    // Simulate restart: read directly from db (same underlying file in real usage)
    const found = createTaskDb(inMemoryDb).findById(id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });
});
