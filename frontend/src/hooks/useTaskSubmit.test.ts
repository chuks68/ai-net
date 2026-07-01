import { useTaskSubmit } from './useTaskSubmit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useTaskSubmit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits task successfully and returns taskId with DAG preview', async () => {
    const taskResponse = {
      taskId: 'task-123',
      dagPreview: {
        nodes: [{ id: 'n1', label: 'Research Agent' }],
        edges: [],
      },
      status: 'created',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => taskResponse,
    } as unknown as Response);

    const { result } = renderHook(() => useTaskSubmit());

    await act(async () => {
      await result.current.submitTask({
        prompt: 'Test prompt',
        maxBudgetXLM: 1,
        agentPreferences: ['research'],
      });
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual(taskResponse);
    expect(result.current.error).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', expect.any(Object));
  });

  it('sets error state when task submission fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Service Unavailable',
      text: async () => 'Service Unavailable',
    } as unknown as Response);

    const { result } = renderHook(() => useTaskSubmit());

    await act(async () => {
      await expect(
        result.current.submitTask({
          prompt: 'Test prompt',
          maxBudgetXLM: 1,
          agentPreferences: ['research'],
        }),
      ).rejects.toThrow('Task submission failed: Service Unavailable');
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Task submission failed: Service Unavailable');
    expect(result.current.data).toBeNull();
  });
});
