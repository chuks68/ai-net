import { DesignAgent, DesignOutput } from '../src/agents/design/design';
import { getAgent } from '../src/registry/registry';
import { VeniceClient } from '../src/venice/venice';

const makeVenice = (response: object) => ({
  complete: jest.fn().mockResolvedValue(JSON.stringify(response)),
  getModelForAgent: jest.fn().mockReturnValue('venice-xl'),
  stream: jest.fn(),
});

const baseDesignResponse = {
  components: ['API Gateway', 'Order Service', 'Postgres Database'],
  interactions: [
    'Client calls API Gateway',
    'API Gateway routes to Order Service',
    'Order Service persists to Postgres Database',
  ],
  diagrams: [
    {
      title: 'System Overview',
      type: 'flowchart',
      description: 'High-level component flow from client to database.',
    },
    {
      title: 'Order Creation',
      type: 'sequence',
      description: 'Sequence of calls when creating an order.',
    },
  ],
  rationale: 'A layered service architecture keeps concerns isolated and scalable.',
};

describe('DesignAgent', () => {
  it('returns valid DesignOutput with at least 1 component and 1 diagram', async () => {
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    const result = await agent.execute({
      prompt: 'Design an order management system',
    });
    const output = result.data as DesignOutput;

    expect(output.components.length).toBeGreaterThanOrEqual(1);
    expect(output.diagrams.length).toBeGreaterThanOrEqual(1);
    expect(output.components).toContain('API Gateway');
    expect(output.diagrams[0].type).toBe('flowchart');
    expect(output.rationale).toBeTruthy();
    expect(result.capability).toBe('design');
  });

  it('uses venice-xl model via getModelForAgent', async () => {
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await agent.execute({ prompt: 'Design a service' });

    expect(venice.getModelForAgent).toHaveBeenCalledWith('design');
    expect(venice.complete).toHaveBeenCalledWith(
      expect.any(String),
      'venice-xl',
    );
  });

  it('Zod rejects response missing components field', async () => {
    const venice = makeVenice({
      interactions: [],
      diagrams: [
        {
          title: 'Overview',
          type: 'flowchart',
          description: 'A diagram.',
        },
      ],
      rationale: 'Some rationale.',
    });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('Zod rejects a diagram with an invalid type', async () => {
    const venice = makeVenice({
      ...baseDesignResponse,
      diagrams: [
        {
          title: 'Bad Diagram',
          type: 'gantt',
          description: 'Unsupported diagram type.',
        },
      ],
    });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('Zod rejects a response with an empty diagrams array', async () => {
    const venice = makeVenice({ ...baseDesignResponse, diagrams: [] });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('registers with capability "design" on module load', () => {
    const meta = getAgent('design-agent-1');
    expect(meta?.capability).toBe('design');
  });

  it('includes upstream context when upstreamResults are provided', async () => {
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await agent.execute({
      prompt: 'Design a system',
      upstreamResults: [
        {
          agentId: 'research-1',
          agentName: 'Research Agent',
          capability: 'research',
          data: { summary: 'Event-driven patterns recommended' },
        },
      ],
    });

    const promptArg = venice.complete.mock.calls[0][0] as string;
    expect(promptArg).toContain('Event-driven patterns recommended');
  });

  it('healthCheck returns false when VENICE_API_KEY is not set', async () => {
    delete process.env.VENICE_API_KEY;
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    const healthy = await agent.healthCheck();
    expect(healthy).toBe(false);
  });
});
