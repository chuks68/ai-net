export interface SubTask {
  taskId?: string;
  nodeId?: string;
  prompt: string;
  context?: unknown;
  upstreamResults?: AgentResult[];
  options?: Record<string, unknown>;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  capability: string;
  data: unknown;
}

export interface Agent {
  execute(task: SubTask): Promise<AgentResult>;
  start(): void;
  healthCheck(): Promise<boolean>;
}

export interface Section {
  heading: string;
  content: string;
  sourceAgents: string[];
}

export interface ReportOutput {
  title: string;
  sections: Section[];
  wordCount: number;
  generatedAt: string;
}

export interface ResearchData {
  summary: string;
  keyFindings: string[];
  sources?: Array<{ title: string; url: string }>;
  confidence: number;
}

export interface RiskItem {
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  mitigations: string[];
  critical?: boolean;
}

export interface RiskData {
  risks: RiskItem[];
  overallRiskScore: number;
}

export const MANDATORY_SECTION_HEADINGS = [
  'Executive Summary',
  'Findings',
  'Risk Analysis',
  'Recommendations',
  'Conclusion',
] as const;

export class InsufficientContextError extends Error {
  constructor(message = 'No upstream agent results provided') {
    super(message);
    this.name = 'InsufficientContextError';
  }
}
