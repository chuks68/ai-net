import {
  ResearchReportResult,
  CodingResult,
  RiskResult,
  RiskItem,
  DesignResult,
  DesignColor,
  ComponentNode
} from '../types/agent';

export function getMarkdown(result: ResearchReportResult | null | undefined): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result;

  if (result.markdown) return result.markdown;
  if (result.content) return result.content;
  
  if (result.summary) {
    let md = `## Summary\n${result.summary}\n\n`;
    if (result.keyFindings && result.keyFindings.length > 0) {
      md += `### Key Findings\n`;
      result.keyFindings.forEach((finding) => {
        md += `- ${finding}\n`;
      });
      md += `\n`;
    }
    if (result.sources && result.sources.length > 0) {
      md += `### Sources\n`;
      result.sources.forEach((source) => {
        md += `- [${source.title}](${source.url})\n`;
      });
    }
    return md;
  }
  return null;
}

export function getCodeDetails(result: CodingResult | null | undefined): { code: string; language: string } | null {
  if (!result) return null;
  if (typeof result === 'string') {
    return { code: result, language: 'javascript' };
  }
  if (result.code) {
    return { code: result.code, language: result.language || 'javascript' };
  }
  return null;
}

export function getRisksList(result: RiskResult | null | undefined): RiskItem[] | null {
  if (!result) return null;
  if (Array.isArray(result)) return result;
  if (result.risks && Array.isArray(result.risks)) return result.risks;
  return null;
}

export function getDesignDetails(result: DesignResult | null | undefined): { colors: DesignColor[]; hierarchy: ComponentNode | null } | null {
  if (!result) return null;

  const colorsList: DesignColor[] = [];
  const rawColors = result.colors || result.palette;
  if (Array.isArray(rawColors)) {
    rawColors.forEach((c) => {
      if (typeof c === 'string') {
        colorsList.push({ name: c, hex: c, value: c });
      } else if (c && typeof c === 'object') {
        const hexVal = c.hex || c.value || '';
        colorsList.push({
          name: c.name || hexVal,
          hex: hexVal,
          value: hexVal
        });
      }
    });
  }

  const hierarchy = result.hierarchy || result.components || null;

  return {
    colors: colorsList,
    hierarchy
  };
}
