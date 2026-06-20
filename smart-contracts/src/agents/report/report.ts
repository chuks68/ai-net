import { registerAgent } from '../../registry/registry';
import {
  Agent,
  AgentResult,
  InsufficientContextError,
  MANDATORY_SECTION_HEADINGS,
  ReportOutput,
  ResearchData,
  RiskData,
  Section,
  SubTask,
} from '../../types/agent';
import { VeniceClient } from '../../venice/venice';

const REPORT_AGENT_ID = 'report-1';
const REPORT_AGENT_NAME = 'Report Agent';
const REPORT_CAPABILITY = 'report';

export function computeWordCount(sections: Section[]): number {
  const text = sections.map((section) => section.content).join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

function isResearchData(data: unknown): data is ResearchData {
  if (!data || typeof data !== 'object') return false;
  const record = data as ResearchData;
  return (
    typeof record.summary === 'string' &&
    Array.isArray(record.keyFindings) &&
    typeof record.confidence === 'number'
  );
}

function isRiskData(data: unknown): data is RiskData {
  if (!data || typeof data !== 'object') return false;
  const record = data as RiskData;
  return Array.isArray(record.risks) && typeof record.overallRiskScore === 'number';
}

function findUpstream(
  upstreamResults: AgentResult[],
  capability: string,
): AgentResult | undefined {
  return upstreamResults.find((result) => result.capability === capability);
}

function buildExecutiveSummary(
  prompt: string,
  research: AgentResult | undefined,
  risk: AgentResult | undefined,
): Section {
  const sourceAgents = [research, risk]
    .filter((result): result is AgentResult => Boolean(result))
    .map((result) => result.agentName);

  const researchSummary = isResearchData(research?.data)
    ? research.data.summary
    : 'Upstream research did not include a structured summary.';
  const riskScore = isRiskData(risk?.data)
    ? `Overall risk score: ${risk.data.overallRiskScore.toFixed(2)}.`
    : 'Risk scoring was not available from upstream agents.';

  const content = [
    `This report addresses: ${prompt}`,
    researchSummary,
    riskScore,
  ].join(' ');

  return {
    heading: 'Executive Summary',
    content,
    sourceAgents,
  };
}

function buildFindings(research: AgentResult | undefined): Section {
  const sourceAgents = research ? [research.agentName] : [];

  if (!research || !isResearchData(research.data)) {
    return {
      heading: 'Findings',
      content: 'No structured research findings were supplied by upstream agents.',
      sourceAgents,
    };
  }

  const bullets = research.data.keyFindings.map(
    (finding, index) => `${index + 1}. ${finding}`,
  );

  return {
    heading: 'Findings',
    content: bullets.join(' '),
    sourceAgents,
  };
}

function buildRiskAnalysis(risk: AgentResult | undefined): Section {
  const sourceAgents = risk ? [risk.agentName] : [];

  if (!risk || !isRiskData(risk.data) || risk.data.risks.length === 0) {
    return {
      heading: 'Risk Analysis',
      content: 'No structured risk matrix was supplied by upstream agents.',
      sourceAgents,
    };
  }

  const lines = risk.data.risks.map((item) => {
    const flag = item.critical ? ' [critical]' : '';
    return `${item.category}: ${item.description} Likelihood ${item.likelihood}, impact ${item.impact}.${flag}`;
  });

  return {
    heading: 'Risk Analysis',
    content: lines.join(' '),
    sourceAgents,
  };
}

function buildRecommendations(risk: AgentResult | undefined): Section {
  const sourceAgents = risk ? [risk.agentName] : [];

  if (!risk || !isRiskData(risk.data)) {
    return {
      heading: 'Recommendations',
      content: 'Recommendations require upstream risk analysis with mitigation steps.',
      sourceAgents,
    };
  }

  const mitigations = risk.data.risks.flatMap((item) => item.mitigations);
  const unique = [...new Set(mitigations)];

  const content =
    unique.length > 0
      ? unique.map((item, index) => `${index + 1}. ${item}`).join(' ')
      : 'Define mitigations for each identified risk before market entry.';

  return {
    heading: 'Recommendations',
    content,
    sourceAgents,
  };
}

function buildConclusion(
  upstreamResults: AgentResult[],
  research: AgentResult | undefined,
  risk: AgentResult | undefined,
): Section {
  const sourceAgents = upstreamResults.map((result) => result.agentName);
  const confidence = isResearchData(research?.data)
    ? `Research confidence: ${(research.data.confidence * 100).toFixed(0)}%.`
    : '';
  const riskScore = isRiskData(risk?.data)
    ? `Composite risk score: ${risk.data.overallRiskScore.toFixed(2)}.`
    : '';

  const content = [
    'This report synthesizes upstream agent outputs into an actionable market-entry view.',
    confidence,
    riskScore,
    `It incorporates contributions from ${sourceAgents.join(', ')}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    heading: 'Conclusion',
    content,
    sourceAgents,
  };
}

export function assembleReportFromUpstream(
  prompt: string,
  upstreamResults: AgentResult[],
): ReportOutput {
  const research = findUpstream(upstreamResults, 'research');
  const risk = findUpstream(upstreamResults, 'risk');

  const sections: Section[] = [
    buildExecutiveSummary(prompt, research, risk),
    buildFindings(research),
    buildRiskAnalysis(risk),
    buildRecommendations(risk),
    buildConclusion(upstreamResults, research, risk),
  ];

  for (const heading of MANDATORY_SECTION_HEADINGS) {
    if (!sections.some((section) => section.heading === heading)) {
      throw new Error(`Missing mandatory section: ${heading}`);
    }
  }

  const title = `Market Report: ${prompt}`;

  return {
    title,
    sections,
    wordCount: computeWordCount(sections),
    generatedAt: new Date().toISOString(),
  };
}

export class ReportAgent implements Agent {
  private readonly venice: VeniceClient;

  constructor(veniceClient?: VeniceClient) {
    this.venice = veniceClient ?? new VeniceClient();
  }

  start(): void {
    registerAgent({
      id: REPORT_AGENT_ID,
      name: REPORT_AGENT_NAME,
      capability: REPORT_CAPABILITY,
      priceXLM: 1,
      stellarAddress: '',
    });
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.VENICE_API_KEY);
  }

  async execute(task: SubTask): Promise<AgentResult> {
    const upstreamResults = task.upstreamResults ?? [];

    if (upstreamResults.length === 0) {
      throw new InsufficientContextError();
    }

    const draft = assembleReportFromUpstream(task.prompt, upstreamResults);

    let report = draft;

    try {
      const polished = await this.venice.complete(
        [
          'Polish the following report sections for professional tone.',
          'Return valid JSON only with shape:',
          '{ "title": string, "sections": [{ "heading": string, "content": string, "sourceAgents": string[] }] }',
          'Keep the same headings and sourceAgents arrays.',
          JSON.stringify({ title: draft.title, sections: draft.sections }),
        ].join('\n'),
        REPORT_CAPABILITY,
      );

      const parsed = JSON.parse(polished) as {
        title?: string;
        sections?: Section[];
      };

      if (parsed.sections?.length === MANDATORY_SECTION_HEADINGS.length) {
        report = {
          title: parsed.title ?? draft.title,
          sections: parsed.sections,
          wordCount: computeWordCount(parsed.sections),
          generatedAt: new Date().toISOString(),
        };
      }
    } catch {
      report = draft;
    }

    return {
      agentId: REPORT_AGENT_ID,
      agentName: REPORT_AGENT_NAME,
      capability: REPORT_CAPABILITY,
      data: report,
    };
  }
}
