import {
  ReportAgent,
  assembleReportFromUpstream,
  computeWordCount,
} from '../../src/agents/report/report';
import {
  clearRegistry,
  discoverAgents,
  getAgent,
} from '../../src/registry/registry';
import {
  AgentResult,
  InsufficientContextError,
  MANDATORY_SECTION_HEADINGS,
  ReportOutput,
  Section,
} from '../../src/types/agent';
import { VeniceClient } from '../../src/venice/venice';

const researchFixture: AgentResult = {
  agentId: 'research-1',
  agentName: 'Research Agent',
  capability: 'research',
  data: {
    summary: 'Solar adoption is accelerating across Southeast Asia.',
    keyFindings: [
      'Vietnam leads regional solar capacity growth.',
      'Policy incentives remain fragmented by country.',
      'Grid integration costs vary widely.',
    ],
    sources: [
      { title: 'IEA Southeast Asia Outlook', url: 'https://example.com/iea' },
    ],
    confidence: 0.82,
  },
};

const riskFixture: AgentResult = {
  agentId: 'risk-1',
  agentName: 'Risk Agent',
  capability: 'risk',
  data: {
    overallRiskScore: 3.4,
    risks: [
      {
        category: 'Regulatory',
        description: 'Permitting timelines may delay project launches.',
        likelihood: 4,
        impact: 4,
        mitigations: ['Engage local counsel early', 'Stage permits by jurisdiction'],
        critical: true,
      },
      {
        category: 'Financial',
        description: 'Currency volatility affects imported equipment costs.',
        likelihood: 3,
        impact: 3,
        mitigations: ['Hedge FX exposure', 'Source components locally where possible'],
      },
      {
        category: 'Operational',
        description: 'Skilled installer shortages could slow rollout.',
        likelihood: 3,
        impact: 2,
        mitigations: ['Train regional installation partners'],
      },
    ],
  },
};

function expectValidReport(report: ReportOutput, upstream: AgentResult[]) {
  const upstreamNames = new Set(upstream.map((result) => result.agentName));

  expect(report.title).toContain('Market Report:');
  expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const headings = report.sections.map((section: Section) => section.heading);
  expect(headings).toEqual([...MANDATORY_SECTION_HEADINGS]);

  const recomputed = computeWordCount(report.sections);
  expect(Math.abs(report.wordCount - recomputed)).toBeLessThanOrEqual(5);

  for (const section of report.sections) {
    expect(section.content.trim().length).toBeGreaterThan(0);
    expect(section.sourceAgents.length).toBeGreaterThan(0);
    for (const agentName of section.sourceAgents) {
      expect(upstreamNames.has(agentName)).toBe(true);
    }
  }
}

describe('ReportAgent', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers with capability report on startup', () => {
    const agent = new ReportAgent();
    agent.start();

    const registered = discoverAgents('report');
    expect(registered).toHaveLength(1);
    expect(registered[0].capability).toBe('report');
    expect(getAgent('report-1')?.name).toBe('Report Agent');
  });

  it('throws InsufficientContextError when upstreamResults is empty', async () => {
    const agent = new ReportAgent();
    await expect(
      agent.execute({ prompt: 'Solar energy in Southeast Asia' }),
    ).rejects.toBeInstanceOf(InsufficientContextError);
  });

  it('returns all mandatory sections from mocked upstream results', async () => {
    const venice = {
      complete: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as VeniceClient;

    const agent = new ReportAgent(venice);
    const result = await agent.execute({
      prompt: 'Solar energy market entry in Southeast Asia',
      upstreamResults: [researchFixture, riskFixture],
    });

    expectValidReport(result.data as ReportOutput, [researchFixture, riskFixture]);
  });

  it('produces deterministic section structure from fixtures', () => {
    const first = assembleReportFromUpstream(
      'Solar energy market entry in Southeast Asia',
      [researchFixture, riskFixture],
    );
    const second = assembleReportFromUpstream(
      'Solar energy market entry in Southeast Asia',
      [researchFixture, riskFixture],
    );

    expect(second).toEqual(first);
    expect(first.sections[0].heading).toBe('Executive Summary');
    expect(first.sections[1].heading).toBe('Findings');
    expect(first.sections[2].heading).toBe('Risk Analysis');
    expect(first.sections[3].heading).toBe('Recommendations');
    expect(first.sections[4].heading).toBe('Conclusion');
  });

  it('attributes findings to the research agent and risks to the risk agent', () => {
    const report = assembleReportFromUpstream('Solar market entry', [
      researchFixture,
      riskFixture,
    ]);

    const findings = report.sections.find(
      (section: Section) => section.heading === 'Findings',
    );
    const riskAnalysis = report.sections.find(
      (section: Section) => section.heading === 'Risk Analysis',
    );

    expect(findings?.sourceAgents).toEqual(['Research Agent']);
    expect(riskAnalysis?.sourceAgents).toEqual(['Risk Agent']);
    expect(findings?.content).toContain('Vietnam leads regional solar capacity growth.');
    expect(riskAnalysis?.content).toContain('[critical]');
  });
});
