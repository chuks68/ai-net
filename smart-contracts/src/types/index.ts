export interface AgentMeta {
  id: string;
  name: string;
  capability: string;
  priceXLM: number;
  stellarAddress: string;
}

export interface SubTask {
  prompt: string;
  context?: AgentResult;
}

export interface AgentResult {
  agentId: string;
  output: unknown;
}

export interface Agent {
  meta: AgentMeta;
  execute(task: SubTask): Promise<AgentResult>;
}
