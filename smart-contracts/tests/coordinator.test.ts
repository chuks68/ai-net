import { registerAgent, clearRegistry } from '../src/registry/registry';
import { executeDAG, DAGNode } from '../src/coordinator/coordinator';
import { Agent, AgentResult, SubTask } from '../src/types/agent';

class MockAgent implements Agent {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly capability: string
  ) {}

  start() {}
  async healthCheck() { return true; }

  async execute(task: SubTask): Promise<AgentResult> {
    return {
      agentId: this.id,
      agentName: this.name,
      capability: this.capability,
      data: {
        receivedPrompt: task.prompt,
        receivedUpstreamCount: task.upstreamResults?.length || 0,
        upstreamData: task.upstreamResults?.map(r => r.data)
      }
    };
  }
}

describe('Coordinator', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('executes a full 5-node DAG and verifies context threading', async () => {
    // 1. Setup real agent stubs
    const researchAgent = new MockAgent('agent-research', 'Research Agent', 'research');
    const riskAgent = new MockAgent('agent-risk', 'Risk Agent', 'risk');
    const codingAgent = new MockAgent('agent-coding', 'Coding Agent', 'coding');
    const designAgent = new MockAgent('agent-design', 'Design Agent', 'design');
    const reportAgent = new MockAgent('agent-report', 'Report Agent', 'report');

    // Register them (we cast to any because registry.Agent has slightly different fields than types.Agent)
    registerAgent(researchAgent as any);
    registerAgent(riskAgent as any);
    registerAgent(codingAgent as any);
    registerAgent(designAgent as any);
    registerAgent(reportAgent as any);

    // 2. Define the DAG
    const dag: DAGNode[] = [
      {
        nodeId: 'node-research',
        taskType: 'Perform initial research',
        dependsOn: [],
        assignedAgent: 'agent-research',
        status: 'pending'
      },
      {
        nodeId: 'node-risk',
        taskType: 'Analyze risks',
        dependsOn: ['node-research'],
        assignedAgent: 'agent-risk',
        status: 'pending'
      },
      {
        nodeId: 'node-coding',
        taskType: 'Write code',
        dependsOn: ['node-research'],
        assignedAgent: 'agent-coding',
        status: 'pending'
      },
      {
        nodeId: 'node-design',
        taskType: 'Create design',
        dependsOn: ['node-research'],
        assignedAgent: 'agent-design',
        status: 'pending'
      },
      {
        nodeId: 'node-report',
        taskType: 'Assemble report',
        dependsOn: ['node-risk', 'node-coding'],
        assignedAgent: 'agent-report',
        status: 'pending'
      }
    ];

    // 3. Execute
    const results = await executeDAG(dag);

    // 4. Verification
    expect(results.size).toBe(5);
    expect(results.has('node-research')).toBe(true);
    expect(results.has('node-risk')).toBe(true);
    expect(results.has('node-coding')).toBe(true);
    expect(results.has('node-design')).toBe(true);
    expect(results.has('node-report')).toBe(true);

    // Verify context threading
    const riskResult = results.get('node-risk')!;
    expect((riskResult.data as any).receivedUpstreamCount).toBe(1);
    expect((riskResult.data as any).upstreamData[0].receivedPrompt).toBe('Perform initial research');

    const codingResult = results.get('node-coding')!;
    expect((codingResult.data as any).receivedUpstreamCount).toBe(1);

    const reportResult = results.get('node-report')!;
    expect((reportResult.data as any).receivedUpstreamCount).toBe(2);
    
    // Verify all nodes completed
    dag.forEach(node => {
      expect(node.status).toBe('completed');
    });
  });

  it('throws error if agent is not found', async () => {
    const dag: DAGNode[] = [
      {
        nodeId: 'n1',
        taskType: 'test',
        dependsOn: [],
        assignedAgent: 'missing-agent',
        status: 'pending'
      }
    ];

    await expect(executeDAG(dag)).rejects.toThrow('Agent missing-agent not found in registry');
  });
});
