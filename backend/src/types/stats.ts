export interface TimePoint {
  timestamp: string;
  value: number;
}

export interface StatsResponse {
  totalAgents: number;
  totalTasks: number;
  totalXLMTransacted: number;
  uptimePercent: number;
  tasksLast24h: TimePoint[];
  xlmLast24h: TimePoint[];
}
