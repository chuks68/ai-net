import type { StatsResponse } from '../types/stats';

export interface StatsCacheOptions {
  ttlMs?: number;
  now?: () => number;
  computeStats: () => Promise<StatsResponse>;
}

export class StatsCache {
  private ttlMs: number;
  private now: () => number;
  private computeStats: () => Promise<StatsResponse>;
  private cacheTimestamp = 0;
  private cached?: StatsResponse;
  private pending?: Promise<StatsResponse>;

  constructor(options: StatsCacheOptions) {
    this.ttlMs = options.ttlMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.computeStats = options.computeStats;
  }

  async get(): Promise<StatsResponse> {
    const currentTime = this.now();

    if (this.cached && currentTime - this.cacheTimestamp < this.ttlMs) {
      return this.cached;
    }

    if (this.pending) {
      return this.pending;
    }

    this.pending = this.computeStats().then((stats) => {
      this.cached = stats;
      this.cacheTimestamp = currentTime;
      return stats;
    }).finally(() => {
      this.pending = undefined;
    });

    return this.pending;
  }

  invalidate(): void {
    this.cacheTimestamp = 0;
    this.cached = undefined;
  }
}
