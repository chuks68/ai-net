import { Router, Request, Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getTaskDb, createTaskDb } from "../../db/tasks";
import { decompose } from "../../coordinator";
import type { Task } from "../../types/task";

export const tasksRouter = Router();

const CreateTaskSchema = z.object({
  prompt: z.string().min(1),
  maxBudgetXLM: z.number().min(0.1),
  agentPreferences: z.array(z.string()).optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// POST /api/tasks
tasksRouter.post("/", (req: Request, res: Response): void => {
  const parse = CreateTaskSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const { prompt } = parse.data;
  const walletPublicKey = (req.headers["walletpublickey"] as string) ?? "";

  const dag = decompose(prompt);
  const now = new Date().toISOString();
  const task: Task = {
    id: `task_${nanoid(12)}`,
    prompt,
    walletPublicKey,
    status: "queued",
    dagJson: JSON.stringify(dag),
    createdAt: now,
    updatedAt: now,
  };

  const db = createTaskDb(getTaskDb());
  db.insert(task);

  res.status(201).json({ taskId: task.id, dagPreview: dag, status: "queued" });
});

// GET /api/tasks
tasksRouter.get("/", (req: Request, res: Response): void => {
  const walletPublicKey = (req.headers["walletpublickey"] as string) ?? "";
  const parse = PaginationSchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const { page, pageSize } = parse.data;
  const db = createTaskDb(getTaskDb());
  const { tasks, total } = db.list(walletPublicKey, page, pageSize);

  res.json({ tasks: tasks.map(t => ({ ...t, dag: JSON.parse(t.dagJson) })), total, page, pageSize });
});

// GET /api/tasks/:id
tasksRouter.get("/:id", (req: Request, res: Response): void => {
  const db = createTaskDb(getTaskDb());
  const task = db.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ ...task, dag: JSON.parse(task.dagJson) });
});

// DELETE /api/tasks/:id
tasksRouter.delete("/:id", (req: Request, res: Response): void => {
  const db = createTaskDb(getTaskDb());
  const task = db.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (task.status === "running") {
    res.status(409).json({ error: "Cannot cancel a running task" });
    return;
  }
  db.updateStatus(req.params.id, "cancelled");
  res.json({ taskId: req.params.id, status: "cancelled" });
});
