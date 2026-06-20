import type { Task, DAGNode } from './types';

/** Volatile in-memory task store.  Swap for SQLite/Postgres in production. */
const store = new Map<string, Task>();

export function createTask(task: Task): void {
  store.set(task.taskId, task);
}

export function getTask(taskId: string): Task | undefined {
  return store.get(taskId);
}

export function updateTask(taskId: string, patch: Partial<Task>): Task {
  const existing = store.get(taskId);
  if (!existing) throw new Error(`Task ${taskId} not found`);
  const updated: Task = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  store.set(taskId, updated);
  return updated;
}

export function updateNode(taskId: string, nodeId: string, patch: Partial<DAGNode>): void {
  const task = store.get(taskId);
  if (!task) return;
  const idx = task.dag.findIndex(n => n.nodeId === nodeId);
  if (idx === -1) return;
  task.dag[idx] = { ...task.dag[idx], ...patch };
  task.updatedAt = new Date().toISOString();
}
