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
  return Array.from(agents.values()).filter(
    (agent) => agent.capability === capability
  );
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}
