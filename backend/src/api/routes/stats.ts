import { Router } from 'express';
import { getStats, type DbClient } from '../../db/stats';
import { StatsCache } from '../../utils/statsCache';

export function createStatsRouter(db: DbClient) {
  const router = Router();
  const cache = new StatsCache({
    ttlMs: 60_000,
    computeStats: () => getStats(db)
  });

  router.get('/stats', async (req, res) => {
    try {
      const stats = await cache.get();
      return res.status(200).json(stats);
    } catch (error) {
      console.error('Failed to load stats', error);
      return res.status(500).json({ error: 'Unable to load stats' });
    }
  });

  return router;
}
