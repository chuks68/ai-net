export type TaskStatus = "queued" | "running" | "completed" | "cancelled" | "failed";

export interface DagNode {
  id: string;
  agentType: string;
  description: string;
  status: TaskStatus;
  result?: string;
  dependencies: string[];
}

export interface Task {
  id: string;
  prompt: string;
  walletPublicKey: string;
  status: TaskStatus;
  dagJson: string; // JSON-serialised DagNode[]
  createdAt: string;
  updatedAt: string;
}
