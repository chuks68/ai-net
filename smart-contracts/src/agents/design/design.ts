import { z } from 'zod';
import { registerAgent } from '../../registry/registry';
import { Agent, AgentResult, SubTask } from '../../types/agent';
import { VeniceClient } from '../../venice/venice';

const DiagramSpecSchema = z.object({
  title: z.string(),
  type: z.enum(['flowchart', 'sequence', 'erd']),
  description: z.string(),
});

const DesignOutputSchema = z.object({
  components: z.array(z.string()).min(1, 'At least one component is required'),
  interactions: z.array(z.string()),
  diagrams: z
    .array(DiagramSpecSchema)
    .min(1, 'At least one diagram is required'),
  rationale: z.string(),
});

export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;
export type DesignOutput = z.infer<typeof DesignOutputSchema>;

const AGENT_ID = 'design-agent-1';
const AGENT_NAME = 'Design Agent';
const AGENT_CAPABILITY = 'design';

export class DesignAgent implements Agent {
  constructor(private readonly venice: VeniceClient) {}

  start(): void {
    // registration happens on module load
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.VENICE_API_KEY);
  }

  async execute(task: SubTask): Promise<AgentResult> {
    const upstreamContext = task.upstreamResults?.length
      ? `\n\nUpstream context:\n${JSON.stringify(task.upstreamResults, null, 2)}`
      : '';

    const prompt = [
      'You are a software architecture design assistant. Respond with valid JSON only, no markdown.',
      'Format: {"components":["string"],"interactions":["string"],"diagrams":[{"title":"string","type":"flowchart|sequence|erd","description":"string"}],"rationale":"string"}',
      'Provide at least one component and at least one diagram.',
      upstreamContext,
      `\nTask: ${task.prompt}`,
    ].join('\n');

    const model = this.venice.getModelForAgent(AGENT_CAPABILITY);
    const content = await this.venice.complete(prompt, model);

    const parsed = DesignOutputSchema.parse(JSON.parse(content));

    return {
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
      capability: AGENT_CAPABILITY,
      data: parsed,
    };
  }
}

registerAgent({
  id: AGENT_ID,
  name: AGENT_NAME,
  capability: AGENT_CAPABILITY,
  priceXLM: 1,
  stellarAddress: '',
});
