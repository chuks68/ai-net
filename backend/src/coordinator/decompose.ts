import type { DAGNode } from './types';

/**
 * Decompose a free-form prompt into a 5-node linear DAG:
 * research → risk → coding → design → report
 *
 * Production implementation would use Venice AI to generate the DAG;
 * this deterministic version is sufficient for the pipeline tests.
 */
export function decompose(taskId: string, prompt: string): DAGNode[] {
  const specs: Array<{ nodeId: string; agentType: string; label: string; dependsOn: string[] }> = [
    { nodeId: 'node_research', agentType: 'research', label: 'Research',  dependsOn: [] },
    { nodeId: 'node_risk',     agentType: 'risk',     label: 'Risk',      dependsOn: ['node_research'] },
    { nodeId: 'node_coding',   agentType: 'coding',   label: 'Coding',    dependsOn: ['node_research'] },
    { nodeId: 'node_design',   agentType: 'design',   label: 'Design',    dependsOn: ['node_research'] },
    { nodeId: 'node_report',   agentType: 'report',   label: 'Report',    dependsOn: ['node_risk', 'node_coding', 'node_design'] },
  ];

  return specs.map(s => ({
    nodeId:    s.nodeId,
    agentType: s.agentType,
    prompt:    `[${s.label}] ${prompt}`,
    dependsOn: s.dependsOn,
    status:    'pending',
  }));
}
