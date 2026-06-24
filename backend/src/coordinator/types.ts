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
  /**
   * Per-task monotonic sequence number assigned by the EventBus when the event
   * is emitted. Starts at 0 for each taskId and increments by 1 per event, so
   * a client can resume a stream from a known cursor. Absent only on events
   * that have not yet passed through the bus.
   */
  seq?: number;
}
