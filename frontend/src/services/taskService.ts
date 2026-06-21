import { apiClient, ApiError } from './api';
import type {
  AgentPreference,
  TaskSubmissionPayload,
  TaskSubmitResponse,
  DagNode,
  DagEdge
} from '../types/api';

export type { AgentPreference, TaskSubmissionPayload, TaskSubmitResponse, DagNode, DagEdge };

export async function createTask(
  payload: TaskSubmissionPayload,
): Promise<TaskSubmitResponse> {
  try {
    return await apiClient.post<TaskSubmitResponse>('/api/tasks', payload);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(`Task submission failed: ${error.message}`);
    }
    throw error;
  }
}
