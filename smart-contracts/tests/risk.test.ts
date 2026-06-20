import { z } from 'zod';
import { RiskAgent, RiskItem, RiskOutput } from '../src/agents/risk/risk';
import { getAgent } from '../src/registry/registry';

const makeVenice = (risks: object[]) => ({
  chat: jest.fn().mockResolvedValue(JSON.stringify({ risks })),
});

const baseRisks = [
  { category: 'Regulatory', description: 'Regulatory change risk', likelihood: 3, impact: 3, mitigations: ['Monitor legislation'] },
  { category: 'Financial', description: 'Currency volatility', likelihood: 2, impact: 4, mitigations: ['Hedge exposure'] },
  { category: 'Operational', description: 'Supply chain disruption', likelihood: 4, impact: 4, mitigations: ['Diversify suppliers', 'Safety stock'] },
];

describe('RiskAgent', () => {
  it('execute returns ≥ 3 risk items for a substantive prompt', async () => {
    const agent = new RiskAgent(makeVenice(baseRisks));
    const result = await agent.execute({ prompt: 'Analyze solar energy market entry in Southeast Asia' });
    const output = result.output as RiskOutput;
    expect(output.risks.length).toBeGreaterThanOrEqual(3);
  });

  it('correctly computes overallRiskScore as weighted average of likelihood * impact', async () => {
    const agent = new RiskAgent(makeVenice(baseRisks));
    const result = await agent.execute({ prompt: 'test' });
    const output = result.output as RiskOutput;
    const expected = (3 * 3 + 2 * 4 + 4 * 4) / 3; // (9 + 8 + 16) / 3 = 11
    expect(output.overallRiskScore).toBeCloseTo(expected);
  });

  it('marks items with likelihood >= 4 AND impact >= 4 as critical', async () => {
    const agent = new RiskAgent(makeVenice(baseRisks));
    const result = await agent.execute({ prompt: 'test' });
    const output = result.output as RiskOutput;

    for (const risk of output.risks) {
      if (risk.likelihood >= 4 && risk.impact >= 4) {
        expect(risk.critical).toBe(true);
      } else {
        expect(risk.critical).toBe(false);
      }
    }
    // baseRisks[2] has likelihood=4, impact=4 → must be critical
    expect(output.risks[2].critical).toBe(true);
    // baseRisks[0] has likelihood=3 → not critical
    expect(output.risks[0].critical).toBe(false);
  });

  it('Zod validation rejects a response missing the mitigations field', async () => {
    const badRisks = [
      { category: 'X', description: 'Y', likelihood: 3, impact: 3 }, // no mitigations
    ];
    const agent = new RiskAgent(makeVenice(badRisks));
    await expect(agent.execute({ prompt: 'test' })).rejects.toThrow();
  });

  it('registers with capability "risk" on startup', () => {
    // Module side-effect: registerAgent called on import
    const meta = getAgent('risk-agent-1');
    expect(meta?.capability).toBe('risk');
  });

  it('prompt includes research context when provided', async () => {
    const venice = makeVenice(baseRisks);
    const agent = new RiskAgent(venice);
    await agent.execute({
      prompt: 'Analyze risks',
      context: { agentId: 'research-agent-1', output: { summary: 'Market is growing fast' } },
    });
    const userMessage = venice.chat.mock.calls[0][0].find((m: { role: string }) => m.role === 'user');
    expect(userMessage.content).toContain('Market is growing fast');
  });
});
