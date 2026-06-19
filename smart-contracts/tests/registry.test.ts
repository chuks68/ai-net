/**
 * Unit tests for the On-Chain Agent Registry.
 * The Stellar SDK is fully mocked so no real network calls are made.
 */

// ---------------------------------------------------------------------------
// Mock @stellar/stellar-sdk BEFORE any imports that use it
// ---------------------------------------------------------------------------
jest.mock('@stellar/stellar-sdk', () => {
  const mockTx = {
    sign: jest.fn(),
  };
  const mockTxBuilder = {
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockTx),
  };
  const mockContract = {
    call: jest.fn().mockReturnValue({ type: 'invokeContractFunction' }),
  };
  const mockServer = {
    getAccount: jest.fn().mockResolvedValue({ id: 'mock-account', sequence: '0' }),
    prepareTransaction: jest.fn().mockResolvedValue(mockTx),
    sendTransaction: jest.fn().mockResolvedValue({ status: 'PENDING', hash: 'mock-hash' }),
    getTransaction: jest.fn().mockResolvedValue({
      status: 'SUCCESS',
      returnValue: { type: 'vec', values: [] },
    }),
  };

  return {
    Keypair: {
      random: jest.fn().mockReturnValue({
        publicKey: () => 'GPUBLICKEY',
        secret: () => 'SSECRET',
      }),
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => 'GPUBLICKEY',
        secret: () => 'SSECRET',
      }),
    },
    Networks: { TESTNET: 'Test SDF Network ; September 2015' },
    TransactionBuilder: jest.fn().mockReturnValue(mockTxBuilder),
    BASE_FEE: '100',
    Contract: jest.fn().mockReturnValue(mockContract),
    nativeToScVal: jest.fn().mockReturnValue({ type: 'string' }),
    scValToNative: jest.fn().mockReturnValue([]),
    SorobanRpc: {
      Server: jest.fn().mockReturnValue(mockServer),
    },
    xdr: { ScVal: {} },
  };
});

import {
  registerAgent,
  discoverAgents,
  getAgent,
  lookupAgent,
  deregisterAgent,
  updatePricing,
  clearCache,
} from '../src/registry/registry';
import type { AgentRecord } from '../src/types/registry';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeAgent = (overrides: Partial<AgentRecord> = {}): AgentRecord => ({
  id: 'agent-1',
  name: 'Research Agent',
  capability: 'research',
  priceXLM: 1.5,
  stellarAddress: 'GPUBLICKEY',
  endpoint: 'https://agent.example.com',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent Registry', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  // ── registerAgent ─────────────────────────────────────────────────────────

  describe('registerAgent', () => {
    it('registers an agent and makes it discoverable', async () => {
      const agent = makeAgent();
      await registerAgent(agent);

      const results = discoverAgents('research');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('agent-1');
    });

    it('registers and discovers an agent by capability (original test compat)', async () => {
      await registerAgent({ id: 't1', name: 'Test', capability: 'research', priceXLM: 1, stellarAddress: '' });
      const results = discoverAgents('research');
      expect(results.some((a) => a.id === 't1')).toBe(true);
    });

    it('stores registeredAt timestamp', async () => {
      const before = Date.now();
      await registerAgent(makeAgent());
      const agent = getAgent('agent-1');
      expect(agent?.registeredAt).toBeGreaterThanOrEqual(before);
    });

    it('registers multiple agents under different capabilities', async () => {
      await registerAgent(makeAgent({ id: 'r1', capability: 'research' }));
      await registerAgent(makeAgent({ id: 'k1', capability: 'risk' }));

      expect(discoverAgents('research')).toHaveLength(1);
      expect(discoverAgents('risk')).toHaveLength(1);
    });
  });

  // ── discoverAgents ────────────────────────────────────────────────────────

  describe('discoverAgents', () => {
    it('returns empty array for unknown capability', () => {
      expect(discoverAgents('nonexistent-capability-xyz')).toEqual([]);
    });

    it('returns all agents matching a capability', async () => {
      await registerAgent(makeAgent({ id: 'r1' }));
      await registerAgent(makeAgent({ id: 'r2' }));
      await registerAgent(makeAgent({ id: 'k1', capability: 'risk' }));

      expect(discoverAgents('research')).toHaveLength(2);
    });

    it('respects 30s TTL — expired entries are not returned', async () => {
      await registerAgent(makeAgent());
      // Manually expire by manipulating Date.now
      const realNow = Date.now;
      global.Date.now = jest.fn(() => realNow() + 31_000);
      expect(discoverAgents('research')).toEqual([]);
      global.Date.now = realNow;
    });
  });

  // ── getAgent ──────────────────────────────────────────────────────────────

  describe('getAgent', () => {
    it('retrieves an agent by id', async () => {
      await registerAgent({ id: 't2', name: 'Test2', capability: 'risk', priceXLM: 2, stellarAddress: '' });
      expect(getAgent('t2')?.name).toBe('Test2');
    });

    it('returns null for unknown id', () => {
      expect(getAgent('unknown-id')).toBeNull();
    });

    it('returns null after cache expires', async () => {
      await registerAgent(makeAgent());
      const realNow = Date.now;
      global.Date.now = jest.fn(() => realNow() + 31_000);
      expect(getAgent('agent-1')).toBeNull();
      global.Date.now = realNow;
    });
  });

  // ── lookupAgent ───────────────────────────────────────────────────────────

  describe('lookupAgent', () => {
    it('returns cached agents without hitting the network', async () => {
      const { SorobanRpc } = jest.requireMock('@stellar/stellar-sdk');
      const mockServer = new SorobanRpc.Server();

      await registerAgent(makeAgent());
      const results = await lookupAgent('research');

      expect(results).toHaveLength(1);
      expect(results[0].capability).toBe('research');
      // No network call because cache was warm
      expect(mockServer.sendTransaction).not.toHaveBeenCalled();
    });

    it('returns empty array without CONTRACT_ID and no cached agents', async () => {
      const results = await lookupAgent('research');
      expect(results).toEqual([]);
    });

    it('returns empty array for capability not in cache', async () => {
      await registerAgent(makeAgent({ capability: 'risk' }));
      const results = await lookupAgent('research');
      expect(results).toEqual([]);
    });
  });

  // ── deregisterAgent ───────────────────────────────────────────────────────

  describe('deregisterAgent', () => {
    it('removes agent from cache', async () => {
      await registerAgent(makeAgent());
      expect(getAgent('agent-1')).not.toBeNull();

      const { Keypair } = jest.requireMock('@stellar/stellar-sdk');
      await deregisterAgent('agent-1', Keypair.random());

      expect(getAgent('agent-1')).toBeNull();
      expect(discoverAgents('research')).toEqual([]);
    });

    it('is a no-op for agents that do not exist in cache', async () => {
      const { Keypair } = jest.requireMock('@stellar/stellar-sdk');
      // Should not throw
      await expect(
        deregisterAgent('nonexistent-id', Keypair.random())
      ).resolves.toBeUndefined();
    });
  });

  // ── updatePricing ─────────────────────────────────────────────────────────

  describe('updatePricing', () => {
    it('updates agent price in cache and returns a price_updated event', async () => {
      await registerAgent(makeAgent());

      const { Keypair } = jest.requireMock('@stellar/stellar-sdk');
      const event = await updatePricing('agent-1', 9.99, Keypair.random());

      expect(event.type).toBe('price_updated');
      expect(event.agentId).toBe('agent-1');
      expect(event.data?.newPriceXLM).toBe(9.99);
      expect(typeof event.timestamp).toBe('number');

      const updated = getAgent('agent-1');
      expect(updated?.priceXLM).toBe(9.99);
    });

    it('still returns an event when agent is not in cache', async () => {
      const { Keypair } = jest.requireMock('@stellar/stellar-sdk');
      const event = await updatePricing('ghost-agent', 5, Keypair.random());

      expect(event.type).toBe('price_updated');
      expect(event.agentId).toBe('ghost-agent');
    });
  });

  // ── clearCache ────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('removes all cached entries', async () => {
      await registerAgent(makeAgent({ id: 'a1' }));
      await registerAgent(makeAgent({ id: 'a2', capability: 'risk' }));

      clearCache();

      expect(getAgent('a1')).toBeNull();
      expect(getAgent('a2')).toBeNull();
    });
  });
});
