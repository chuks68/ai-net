import { registerAgent, discoverAgents, getAgent, clearRegistry } from '../src/registry/registry';

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

  it('retrieves an agent by id', () => {
    registerAgent({ id: 't2', name: 'Test2', capability: 'risk', priceXLM: 2, stellarAddress: '' });
    expect(getAgent('t2')?.name).toBe('Test2');
  });
});
