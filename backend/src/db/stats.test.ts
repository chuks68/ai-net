import { getStats } from './stats';

const now = new Date('2026-06-17T12:00:00.000Z');

function createMockDb() {
  return {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      if (text.includes('FROM agents')) {
        return { rows: [{ count: 15 }] };
      }

      if (text.includes('FROM tasks') && text.includes('SUM(CASE WHEN status =')) {
        return { rows: [{ total: 10, succeeded: 8 }] };
      }

      if (text.includes('DATE_TRUNC') && text.includes('FROM tasks')) {
        return {
          rows: [
            { hour: '2026-06-16T13:00:00.000Z', count: 2 },
            { hour: '2026-06-16T17:00:00.000Z', count: 3 },
            { hour: '2026-06-17T12:00:00.000Z', count: 4 }
          ]
        };
      }

      if (text.includes('COUNT(*) AS count FROM tasks')) {
        return { rows: [{ count: 154 }] };
      }

      if (text.includes('COALESCE(SUM(amount)') && text.includes('FROM payments')) {
        if (text.includes('GROUP BY hour')) {
          return {
            rows: [
              { hour: '2026-06-16T13:00:00.000Z', sum: 15_000_000 },
              { hour: '2026-06-16T17:00:00.000Z', sum: 5_000_000 },
              { hour: '2026-06-17T12:00:00.000Z', sum: 10_000_000 }
            ]
          };
        }

        return { rows: [{ amount: 123456789 }] };
      }

      return { rows: [] };
    })
  };
}

describe('getStats', () => {
  it('builds 24 hourly points and computes uptime and XLM transacted precisely', async () => {
    const db = createMockDb();
    const stats = await getStats(db as any, now);

    expect(stats.totalAgents).toBe(15);
    expect(stats.totalTasks).toBe(154);
    expect(stats.uptimePercent).toBe(80);
    expect(stats.totalXLMTransacted).toBe(12.3456789);
    expect(stats.tasksLast24h).toHaveLength(24);
    expect(stats.xlmLast24h).toHaveLength(24);
    expect(stats.tasksLast24h[0].timestamp).toBe('2026-06-16T13:00:00.000Z');
    expect(stats.tasksLast24h[0].value).toBe(2);
    expect(stats.tasksLast24h[4].value).toBe(3);
    expect(stats.tasksLast24h[23].value).toBe(4);
    expect(stats.xlmLast24h[0].value).toBe(1.5);
    expect(stats.xlmLast24h[4].value).toBe(0.5);
    expect(stats.xlmLast24h[23].value).toBe(1);
  });

  it('returns 100 uptime percent when no tasks exist in the last 7 days', async () => {
    const db = {
      query: jest.fn(async (text: string) => {
        if (text.includes('FROM agents')) return { rows: [{ count: 1 }] };
        if (text.includes('FROM tasks') && text.includes('SUM(CASE WHEN status =')) return { rows: [{ total: 0, succeeded: 0 }] };
        if (text.includes('DATE_TRUNC') && text.includes('FROM tasks')) return { rows: [] };
        if (text.includes('COUNT(*) AS count FROM tasks')) return { rows: [{ count: 0 }] };
        if (text.includes('COALESCE(SUM(amount)') && text.includes('GROUP BY hour')) return { rows: [] };
        if (text.includes('COALESCE(SUM(amount)')) return { rows: [{ amount: 0 }] };
        return { rows: [] };
      })
    };

    const stats = await getStats(db as any, now);
    expect(stats.uptimePercent).toBe(100);
  });
});
