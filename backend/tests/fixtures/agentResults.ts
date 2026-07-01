import type { AgentResult } from '../../src/agents/research/types';

const sources = [
  { url: 'https://example.com/solar-sea-1', title: 'Solar Market SEA 2024' },
  { url: 'https://example.com/solar-sea-2', title: 'ASEAN Energy Outlook' },
  { url: 'https://example.com/solar-sea-3', title: 'IEA Renewables Report' },
  { url: 'https://example.com/solar-sea-4', title: 'World Bank Solar Data' },
];

export const researchFixture: AgentResult = {
  taskId:      'placeholder',
  nodeId:      'node_research',
  summary:     'Southeast Asia solar energy market is growing rapidly, driven by falling panel costs and government incentives across Thailand, Vietnam, and the Philippines.',
  keyFindings: [
    'Solar capacity in SEA grew 30% YoY in 2023.',
    'Vietnam leads with 16 GW installed capacity.',
    'Grid infrastructure remains the primary constraint.',
    'PPAs with utilities are the dominant go-to-market model.',
  ],
  sources,
  confidence: 0.9,
};

export const riskFixture: AgentResult = {
  taskId:      'placeholder',
  nodeId:      'node_risk',
  summary:     'Regulatory uncertainty and currency risk are the top barriers to market entry.',
  keyFindings: [
    'Feed-in tariff changes in Vietnam create policy risk.',
    'USD-denominated debt exposes projects to FX volatility.',
    'Grid curtailment risk is high in peak generation periods.',
  ],
  sources: sources.slice(0, 2),
  confidence: 0.6,
};

export const codingFixture: AgentResult = {
  taskId:      'placeholder',
  nodeId:      'node_coding',
  summary:     'Recommended tech stack: Python FastAPI backend, React dashboard, PostgreSQL for time-series data.',
  keyFindings: [
    'FastAPI provides async support for real-time monitoring.',
    'React + Recharts renders solar generation sparklines.',
  ],
  sources: [],
  confidence: 0.3,
};

export const designFixture: AgentResult = {
  taskId:      'placeholder',
  nodeId:      'node_design',
  summary:     'Dashboard design uses a dark theme with green accent colours to match sustainability branding.',
  keyFindings: [
    'Color palette: #1A1A2E primary, #00FF7F accent.',
    'Mobile-first layout for field technician use.',
  ],
  sources: [],
  confidence: 0.3,
};

export const reportFixture: AgentResult = {
  taskId:      'placeholder',
  nodeId:      'node_report',
  summary: `
# Market Entry Report: Solar Energy in Southeast Asia

## Executive Summary
Southeast Asia presents a compelling solar energy market opportunity driven by rapid demand growth and supportive government policies.

## Findings
Vietnam, Thailand, and the Philippines collectively account for 80% of installed solar capacity in the region.

## Risk Analysis
Regulatory volatility and grid infrastructure gaps are the primary risks. Currency exposure should be hedged via local-currency PPAs.

## Recommendations
Enter through a joint venture with a local utility partner to navigate regulatory requirements and secure grid connection rights.

## Conclusion
A phased entry strategy starting in Vietnam, expanding to the Philippines within 24 months, offers the best risk-adjusted return profile.
  `.trim(),
  keyFindings: [
    'Executive Summary included.',
    'Findings included.',
    'Risk Analysis included.',
    'Recommendations included.',
    'Conclusion included.',
  ],
  sources: sources.slice(0, 3),
  confidence: 0.6,
};
