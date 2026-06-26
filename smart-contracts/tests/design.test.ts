import { DesignAgent, DesignOutput } from '../src/agents/design/design';
import { getAgent } from '../src/registry/registry';
import { VeniceClient } from '../src/venice/venice';

const makeVenice = (response: object) => ({
  complete: jest.fn().mockResolvedValue(JSON.stringify(response)),
  getModelForAgent: jest.fn().mockReturnValue('venice-xl'),
  stream: jest.fn(),
});

const baseDesignResponse = {
  wireframes: [
    {
      name: 'Dashboard Overview',
      description: 'A scan-friendly workspace for product performance.',
      layout: 'grid',
      elements: [
        {
          name: 'KPI Row',
          type: 'metric group',
          description: 'Four key metrics with compact labels and trends.',
        },
      ],
    },
    {
      name: 'Project Detail',
      description: 'A focused view for reviewing work and next actions.',
      layout: 'flex',
      elements: [
        {
          name: 'Activity Timeline',
          type: 'timeline',
          description: 'Chronological product and team updates.',
        },
      ],
    },
  ],
  colorPalette: [
    { name: 'Surface', hex: '#101820', usage: 'Primary app background' },
    { name: 'Panel', hex: '#1E2A32', usage: 'Grouped controls and tables' },
    { name: 'Accent', hex: '#27C5A4', usage: 'Primary actions and highlights' },
    { name: 'Warning', hex: '#F2B84B', usage: 'Attention states' },
  ],
  componentHierarchy: [
    {
      id: 'app-shell',
      name: 'App Shell',
      parentId: null,
      description: 'Owns page chrome and global layout.',
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      parentId: 'app-shell',
      description: 'Displays overview modules.',
    },
    {
      id: 'kpi-row',
      name: 'KPI Row',
      parentId: 'dashboard',
      description: 'Groups performance metrics.',
    },
  ],
  assetManifest: [
    {
      name: 'Status Icons',
      type: 'icon',
      description: 'Consistent glyphs for success, warning, and failure states.',
      suggestedSource: 'lucide-react',
    },
    {
      name: 'Inter UI',
      type: 'font',
      description: 'Readable interface typeface.',
      suggestedSource: 'Google Fonts',
    },
  ],
};

describe('DesignAgent', () => {
  it('returns valid DesignOutput with at least 2 wireframe sections', async () => {
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    const result = await agent.execute({
      prompt: 'Design a product analytics dashboard',
    });
    const output = result.data as DesignOutput;

    expect(output.wireframes.length).toBeGreaterThanOrEqual(2);
    expect(output.colorPalette.length).toBeGreaterThanOrEqual(4);
    expect(output.colorPalette.length).toBeLessThanOrEqual(12);
    expect(output.assetManifest.some((asset) => asset.type === 'icon')).toBe(true);
    expect(result.capability).toBe('design');
  });

  it('uses venice-xl model via getModelForAgent', async () => {
    const venice = makeVenice(baseDesignResponse);
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await agent.execute({ prompt: 'Design a service' });

    expect(venice.getModelForAgent).toHaveBeenCalledWith('design');
    expect(venice.complete).toHaveBeenCalledWith(
      expect.stringContaining('senior product designer'),
      'venice-xl',
    );
  });

  it('Zod rejects invalid hex color values', async () => {
    const venice = makeVenice({
      ...baseDesignResponse,
      colorPalette: [
        ...baseDesignResponse.colorPalette.slice(0, 3),
        { name: 'Broken', hex: '27C5A4', usage: 'Invalid missing hash' },
      ],
    });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('Zod rejects a color palette outside the 4 to 12 token range', async () => {
    const venice = makeVenice({
      ...baseDesignResponse,
      colorPalette: baseDesignResponse.colorPalette.slice(0, 3),
    });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('Zod rejects circular component hierarchy references', async () => {
    const venice = makeVenice({
      ...baseDesignResponse,
      componentHierarchy: [
        {
          id: 'parent',
          name: 'Parent',
          parentId: 'child',
          description: 'Parent node.',
        },
        {
          id: 'child',
          name: 'Child',
          parentId: 'parent',
          description: 'Child node.',
        },
      ],
    });
    const agent = new DesignAgent(venice as unknown as VeniceClient);
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('Zod rejects an asset manifest without an icon', async () => {
    const venice = makeVenice({
      ...baseDesignResponse,
      assetManifest: [
        {
          name: 'Inter UI',
          type: 'font',
          description: 'Readable interface typeface.',
          suggestedSource: 'Google Fonts',
        },
      ],
    });
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
