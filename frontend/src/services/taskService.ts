export type AgentPreference = 'research' | 'risk' | 'coding' | 'design' | 'report';

export type TaskSubmissionPayload = {
  prompt: string;
  maxBudgetXLM: number;
  agentPreferences: AgentPreference[];
};

export type DagNode = {
  id: string;
  label: string;
};

export type DagEdge = {
  source: string;
  target: string;
};

export type TaskSubmitResponse = {
  taskId: string;
  dagPreview: {
    nodes: DagNode[];
    edges: DagEdge[];
  };
  status: string;
};

export async function createTask(
  payload: TaskSubmissionPayload,
): Promise<TaskSubmitResponse> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText);
    throw new Error(`Task submission failed: ${body}`);
  }

  const json = await response.json();
  return json as TaskSubmitResponse;
}
