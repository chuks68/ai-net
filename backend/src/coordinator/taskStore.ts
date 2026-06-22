import type { Task, DAGNode } from './types';
import { getTaskDb, createTaskDb } from '../db/tasks';

function db() {
  return createTaskDb(getTaskDb());
}

/** Convert coordinator Task → DB row shape */
function toRow(task: Task): {
  id: string; prompt: string; walletPublicKey: string;
  status: string; dagJson: string; createdAt: string; updatedAt: string;
} {
  return {
    id: task.taskId,
    prompt: task.prompt,
    walletPublicKey: task.walletPublicKey,
    status: task.status,
    dagJson: JSON.stringify(task.dag),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** Convert DB row → coordinator Task */
function fromRow(row: { id: string; prompt: string; walletPublicKey: string; status: string; dagJson: string; createdAt: string; updatedAt: string }): Task {
  return {
    taskId: row.id,
    prompt: row.prompt,
    walletPublicKey: row.walletPublicKey,
    status: row.status as Task['status'],
    dag: JSON.parse(row.dagJson) as DAGNode[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createTask(task: Task): void {
  db().insert(toRow(task) as Parameters<ReturnType<typeof createTaskDb>['insert']>[0]);
}

export function getTask(taskId: string): Task | undefined {
  const row = db().findById(taskId);
  return row ? fromRow(row) : undefined;
}

export function updateTask(taskId: string, patch: Partial<Task>): Task {
  const existing = getTask(taskId);
  if (!existing) throw new Error(`Task ${taskId} not found`);
  const updated: Task = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const store = db();
  if (patch.status) store.updateStatus(taskId, patch.status as Parameters<typeof store.updateStatus>[1]);
  if (patch.dag) store.updateDagJson(taskId, JSON.stringify(updated.dag));
  return updated;
}

export function updateNode(taskId: string, nodeId: string, patch: Partial<DAGNode>): void {
  const task = getTask(taskId);
  if (!task) return;
  const idx = task.dag.findIndex(n => n.nodeId === nodeId);
  if (idx === -1) return;
  task.dag[idx] = { ...task.dag[idx], ...patch };
  db().updateDagJson(taskId, JSON.stringify(task.dag));
}

export function getEventHistory(taskId: string) {
  return db().getEventHistory(taskId);
}
