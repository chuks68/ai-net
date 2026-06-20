import type { DAGNode, Task } from './types';
import { eventBus } from './eventBus';
import { updateNode, updateTask } from './taskStore';

/** Injected function to dispatch a single node to its agent */
export type DispatchFn = (
  taskId: string,
  node: DAGNode,
  context: string
) => Promise<unknown>;

/** Injected function called after each successful node to release payment */
export type PaymentReleaseFn = (
  taskId: string,
  nodeId: string
) => Promise<string>;

function now(): string {
  return new Date().toISOString();
}

/**
 * Execute a DAG in topological order, running dependency-free nodes concurrently.
 * Emits DAGEvents to the EventBus throughout.
 */
export async function executeDAG(
  task: Task,
  dispatch: DispatchFn,
  releasePayment: PaymentReleaseFn
): Promise<void> {
  const { taskId, dag } = task;
  const completed = new Set<string>();
  const running   = new Set<string>();
  const failed    = new Set<string>();

  updateTask(taskId, { status: 'running' });

  async function runNode(node: DAGNode): Promise<void> {
    running.add(node.nodeId);
    updateNode(taskId, node.nodeId, { status: 'running' });

    eventBus.emit(taskId, {
      type: 'node_started',
      taskId,
      nodeId: node.nodeId,
      timestamp: now(),
    });

    // Build context from upstream results
    const upstreamResults = dag
      .filter(n => node.dependsOn.includes(n.nodeId))
      .map(n => n.result ? JSON.stringify(n.result) : '')
      .join('\n');

    try {
      const result = await dispatch(taskId, node, upstreamResults);

      // Update in-memory dag node with result before emitting event
      node.result = result;
      node.status = 'completed';
      updateNode(taskId, node.nodeId, { status: 'completed', result });

      const txHash = await releasePayment(taskId, node.nodeId);

      eventBus.emit(taskId, {
        type: 'payment_released',
        taskId,
        nodeId: node.nodeId,
        timestamp: now(),
        payload: { txHash },
      });

      eventBus.emit(taskId, {
        type: 'node_completed',
        taskId,
        nodeId: node.nodeId,
        timestamp: now(),
        payload: result,
      });

      completed.add(node.nodeId);
    } catch (err) {
      node.status = 'failed';
      node.error  = err instanceof Error ? err.message : 'unknown';
      updateNode(taskId, node.nodeId, { status: 'failed', error: node.error });

      failed.add(node.nodeId);

      eventBus.emit(taskId, {
        type: 'node_failed',
        taskId,
        nodeId: node.nodeId,
        timestamp: now(),
        payload: { error: node.error },
      });
    } finally {
      running.delete(node.nodeId);
    }
  }

  // Iterate until every node is settled
  while (completed.size + failed.size < dag.length) {
    const ready = dag.filter(
      n =>
        n.status === 'pending' &&
        !running.has(n.nodeId) &&
        n.dependsOn.every(dep => completed.has(dep)) &&
        // Skip if a dependency failed
        !n.dependsOn.some(dep => failed.has(dep))
    );

    if (ready.length === 0 && running.size === 0) {
      // Remaining nodes are blocked by failures
      for (const n of dag.filter(n => n.status === 'pending')) {
        n.status = 'failed';
        n.error  = 'upstream_failed';
        updateNode(taskId, n.nodeId, { status: 'failed', error: 'upstream_failed' });
        failed.add(n.nodeId);
      }
      break;
    }

    if (ready.length > 0) {
      // Run at most 3 concurrently (per Issue #25 spec)
      const batch = ready.slice(0, 3);
      await Promise.all(batch.map(n => runNode(n)));
    } else {
      // Still waiting for in-flight nodes — yield briefly
      await new Promise(r => setTimeout(r, 10));
    }
  }

  const finalStatus = failed.size === 0 ? 'completed' : 'failed';
  updateTask(taskId, { status: finalStatus, dag });

  eventBus.emit(taskId, {
    type: finalStatus === 'completed' ? 'task_completed' : 'task_failed',
    taskId,
    timestamp: now(),
  });
}
