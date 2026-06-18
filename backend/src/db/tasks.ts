import Database from "better-sqlite3";
import path from "path";
import type { Task, TaskStatus } from "../types/task";

let _taskDb: Database.Database | null = null;

export function getTaskDb(dbPath?: string): Database.Database {
  if (!_taskDb) {
    const filePath = dbPath ?? path.join(process.cwd(), "tasks.db");
    _taskDb = new Database(filePath);
    _taskDb.exec(`
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
  }
  return _taskDb;
}

export function closeTaskDb(): void {
  _taskDb?.close();
  _taskDb = null;
}

export interface TaskDb {
  insert(task: Task): void;
  findById(id: string): Task | undefined;
  list(walletPublicKey: string, page: number, pageSize: number): { tasks: Task[]; total: number };
  updateStatus(id: string, status: TaskStatus): void;
}

export function createTaskDb(db: Database.Database): TaskDb {
  return {
    insert(task: Task): void {
      db.prepare(`
        INSERT INTO tasks (id, prompt, walletPublicKey, status, dagJson, createdAt, updatedAt)
        VALUES (@id, @prompt, @walletPublicKey, @status, @dagJson, @createdAt, @updatedAt)
      `).run(task);
    },

    findById(id: string): Task | undefined {
      return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
    },

    list(walletPublicKey: string, page: number, pageSize: number) {
      const offset = (page - 1) * pageSize;
      const tasks = db.prepare(
        "SELECT * FROM tasks WHERE walletPublicKey = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?"
      ).all(walletPublicKey, pageSize, offset) as Task[];
      const { total } = db.prepare(
        "SELECT COUNT(*) as total FROM tasks WHERE walletPublicKey = ?"
      ).get(walletPublicKey) as { total: number };
      return { tasks, total };
    },

    updateStatus(id: string, status: TaskStatus): void {
      db.prepare(
        "UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?"
      ).run(status, new Date().toISOString(), id);
    },
  };
}
