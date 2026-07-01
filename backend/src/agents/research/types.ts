/**
 * Shared types for the Research Agent and the broader agent layer.
 *
 * AgentResult is the canonical output shape returned by every agent's execute()
 * call and consumed by the Coordinator.
 */

/** A single cited source from Venice AI output. */
export interface Source {
  url: string;
  title: string;
}

/** The structured result returned by a successful agent execution. */
export interface AgentResult {
  taskId: string;
  nodeId: string;
  summary: string;
  keyFindings: string[];
  sources: Source[];
  /**
   * Confidence score derived from the number of cited sources:
   *   0 sources  → 0.3
   *   1–3 sources → 0.6
   *   4+ sources  → 0.9
   */
  confidence: number;
}

/**
 * Returned (not thrown) when the agent cannot complete due to an infrastructure
 * failure (e.g. Venice unreachable).
 */
export interface AgentError {
  error: string;
}

/** Input accepted by every agent's execute() method. */
export interface AgentTask {
  taskId: string;
  nodeId: string;
  prompt: string;
  /** Optional upstream results or context forwarded by the Coordinator. */
  context?: string;
}
