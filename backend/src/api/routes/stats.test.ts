import express from 'express';
import type { AddressInfo } from 'net';
import { createStatsRouter } from './stats';
import type { DbClient } from '../../db/stats';

describe('Stats API route', () => {
  it('returns 200 and reuses cached stats for two requests within TTL', async () => {
    const queryMock = jest.fn(async (text: string) => {
      if (text.includes('FROM agents')) return { rows: [{ count: 1 }] };
      if (text.includes('FROM tasks') && text.includes('SUM(CASE WHEN status =')) return { rows: [{ total: 2, succeeded: 2 }] };
      if (text.includes('COUNT(*) AS count FROM tasks')) return { rows: [{ count: 2 }] };
      if (text.includes('DATE_TRUNC') && text.includes('FROM tasks')) return { rows: [] };
      if (text.includes('COALESCE(SUM(amount)') && text.includes('GROUP BY hour')) return { rows: [] };
      if (text.includes('COALESCE(SUM(amount)')) return { rows: [{ amount: 10_000_000 }] };
      return { rows: [] };
    });

    const db: DbClient = { query: queryMock };
    const app = express();
    app.use('/api', createStatsRouter(db));

    const server = app.listen(0);
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const firstResponse = await fetch(`${baseUrl}/api/stats`);
    const firstJson = await firstResponse.json();

    const secondResponse = await fetch(`${baseUrl}/api/stats`);
    const secondJson = await secondResponse.json();

    server.close();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstJson).toEqual(secondJson);
    expect(queryMock).toHaveBeenCalledTimes(6);
  });
});
