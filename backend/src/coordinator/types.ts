/** DAG node statuses */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A single node in the execution DAG */
export interface DAGNode {
  nodeId: string;
  /** Agent type / capability required */
  agentType: string;
  /** Prompt fragment for this node */
  prompt: string;
  /** nodeIds this node depends on */
  dependsOn: string[];
  status: NodeStatus;
  result?: unknown;
  error?: string;
}

/** Persisted task record */
export interface Task {
  taskId: string;
  prompt: string;
  walletPublicKey: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  dag: DAGNode[];
  createdAt: string;
  updatedAt: string;
  /** Correlation ID for distributed tracing across HTTP request → coordinator → agent */
  requestId?: string;
}

/** Events emitted by the coordinator */
export type DAGEventType =
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'payment_locked'
  | 'payment_released'
  | 'task_completed'
  | 'task_failed';

export interface DAGEvent {
  type: DAGEventType;
  taskId: string;
  nodeId?: string;
  timestamp: string;
  payload?: unknown;
}
