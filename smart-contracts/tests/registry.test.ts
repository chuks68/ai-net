import { registerAgent, discoverAgents, getAgent, lookupAgent, deregisterAgent, updatePricing, clearRegistry, clearCache } from '../src/registry/registry';

describe('Agent Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and discovers an agent by capability', () => {
    registerAgent({ id: 't1', name: 'Test', capability: 'research', priceXLM: 1, stellarAddress: '' });
    const results = discoverAgents('research');
    expect(results.some((a) => a.id === 't1')).toBe(true);
  });

  it('returns empty array for unknown capability', () => {
    expect(discoverAgents('nonexistent-capability-xyz')).toEqual([]);
  });

  it('retrieves an agent by id and lookupAgent alias works', () => {
    registerAgent({ id: 't2', name: 'Test2', capability: 'risk', priceXLM: 2, stellarAddress: '' });
    expect(getAgent('t2')?.name).toBe('Test2');
    expect(lookupAgent('t2')?.id).toBe('t2');
  });

  it('updates pricing and preserves other fields', () => {
    registerAgent({ id: 't3', name: 'Test3', capability: 'risk', priceXLM: 2, stellarAddress: '' });
    const updated = updatePricing('t3', 5);
    expect(updated).toEqual({ id: 't3', name: 'Test3', capability: 'risk', priceXLM: 5, stellarAddress: '' });
    expect(getAgent('t3')?.priceXLM).toBe(5);
  });

  it('deregisters an agent and clears cache alias works', () => {
    registerAgent({ id: 't4', name: 'Test4', capability: 'report', priceXLM: 3, stellarAddress: '' });
    expect(deregisterAgent('t4')).toBe(true);
    expect(getAgent('t4')).toBeUndefined();
    registerAgent({ id: 't5', name: 'Test5', capability: 'report', priceXLM: 3, stellarAddress: '' });
    expect(clearCache).toBe(clearRegistry);
    clearCache();
    expect(discoverAgents('report')).toEqual([]);
  });
});
