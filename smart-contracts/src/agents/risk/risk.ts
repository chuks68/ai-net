import { z } from 'zod';
import { Agent, AgentMeta, AgentResult, SubTask } from '../../types';
import { VeniceClient } from '../../venice/client';
import { registerAgent } from '../../registry/registry';

const RiskItemSchema = z.object({
  category: z.string(),
  description: z.string(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigations: z.array(z.string()),
});

const VeniceResponseSchema = z.object({
  risks: z.array(RiskItemSchema).min(1),
});

export type RiskItem = z.infer<typeof RiskItemSchema> & { critical: boolean };

export interface RiskOutput {
  risks: RiskItem[];
  overallRiskScore: number;
}

const AGENT_META: AgentMeta = {
  id: 'risk-agent-1',
  name: 'Risk Agent',
  capability: 'risk',
  priceXLM: 2,
  stellarAddress: '',
};

export class RiskAgent implements Agent {
  readonly meta = AGENT_META;

  constructor(private readonly venice: VeniceClient) {}

  async execute(task: SubTask): Promise<AgentResult> {
    const researchContext = task.context
      ? `\n\nResearch context:\n${JSON.stringify(task.context.output, null, 2)}`
      : '';

    const content = await this.venice.chat([
      {
        role: 'system',
        content:
          'You are a risk analyst. Respond with valid JSON only, no markdown. ' +
          'Format: {"risks":[{"category":"string","description":"string","likelihood":1-5,"impact":1-5,"mitigations":["string"]}]}',
      },
      {
        role: 'user',
        content: `Analyze risks for the following task. Return at least 3 risk items.${researchContext}\n\nTask: ${task.prompt}`,
      },
    ]);

    const parsed = VeniceResponseSchema.parse(JSON.parse(content));

    const risks: RiskItem[] = parsed.risks.map((item) => ({
      ...item,
      critical: item.likelihood >= 4 && item.impact >= 4,
    }));

    const overallRiskScore =
      risks.reduce((sum, r) => sum + r.likelihood * r.impact, 0) / risks.length;

    return {
      agentId: this.meta.id,
      output: { risks, overallRiskScore } satisfies RiskOutput,
    };
  }
}

// Register on module load
registerAgent(AGENT_META);
