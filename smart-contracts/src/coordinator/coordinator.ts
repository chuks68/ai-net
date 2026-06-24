import { getAgent } from '../registry/registry';
import { Agent, AgentResult, SubTask } from '../types/agent';

export interface DAGNode {
  nodeId: string;
  taskType: string;
  dependsOn: string[];
  assignedAgent: string; // agentId
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AgentResult;
  error?: string;
}

/**
 * Resolves the agent from the registry and executes the task.
 * Merges upstream results from dependencies as context.
 */
export async function defaultRunNode(
  node: DAGNode,
  allNodes: Map<string, DAGNode>
): Promise<AgentResult> {
  const agentMeta = getAgent(node.assignedAgent);
  if (!agentMeta) {
    throw new Error(`Agent ${node.assignedAgent} not found in registry`);
  }

  // Merging results from dependencies
  const upstreamResults: AgentResult[] = node.dependsOn
    .map(depId => allNodes.get(depId)?.result)
    .filter((res): res is AgentResult => res !== undefined);

  // We need the agent instance to call execute().
  // In this implementation, we assume the registry stores objects that satisfy the Agent interface.
  const agentInstance = agentMeta as unknown as Agent;
  if (typeof agentInstance.execute !== 'function') {
    throw new Error(`Agent ${node.assignedAgent} does not implement execute()`);
  }

  const task: SubTask = {
    nodeId: node.nodeId,
    prompt: node.taskType,
    upstreamResults: upstreamResults,
    context: upstreamResults.length > 0 ? upstreamResults[0] : undefined // fallback for context
  };

  return await agentInstance.execute(task);
}


export async function executeDAG(dag: DAGNode[]): Promise<Map<string, AgentResult>> {
  const nodeById = new Map<string, DAGNode>(dag.map(n => [n.nodeId, n]));
  const results = new Map<string, AgentResult>();
  const completed = new Set<string>();

  const isReady = (node: DAGNode) => 
    node.dependsOn.every(depId => completed.has(depId));

  while (completed.size < dag.length) {
    const readyNodes = dag.filter(n => n.status === 'pending' && isReady(n));
    
    if (readyNodes.length === 0 && completed.size < dag.length) {
      throw new Error('Cycle detected or stuck in DAG execution');
    }

    await Promise.all(readyNodes.map(async (node) => {
      node.status = 'running';
      try {
        const result = await defaultRunNode(node, nodeById);
        node.result = result;
        node.status = 'completed';
        results.set(node.nodeId, result);
        completed.add(node.nodeId);
      } catch (err) {
        node.status = 'failed';
        node.error = err instanceof Error ? err.message : String(err);
        throw err;
      }
    }));
  }

  return results;
}
