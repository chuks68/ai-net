export interface Agent {
  id: string;
  name: string;
  capability: string;
  priceXLM: number;
  stellarAddress: string;
}

const agents = new Map<string, Agent>();

export function registerAgent(agent: Agent): Agent {
  agents.set(agent.id, agent);
  return agent;
}

export function discoverAgents(capability: string): Agent[] {
  return Array.from(agents.values()).filter((a) => a.capability === capability);
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function lookupAgent(id: string): Agent | undefined {
  return getAgent(id);
}

export function deregisterAgent(id: string): boolean {
  return agents.delete(id);
}

export function updatePricing(id: string, priceXLM: number): Agent | undefined {
  const agent = agents.get(id);
  if (!agent) return undefined;
  const updated = { ...agent, priceXLM };
  agents.set(id, updated);
  return updated;
}

export function clearRegistry(): void {
  agents.clear();
}

export const clearCache = clearRegistry;
