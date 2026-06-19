import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  SorobanRpc,
  xdr,
} from '@stellar/stellar-sdk';
import type { AgentRecord, Capability, RegistryEvent } from '../types/registry';

export type { AgentRecord, Capability, RegistryEvent };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RPC_URL =
  process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID ?? '';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Local TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const agentCache = new Map<string, CacheEntry<AgentRecord>>();

function cacheGet(id: string): AgentRecord | null {
  const entry = agentCache.get(id);
  if (!entry || Date.now() > entry.expiresAt) {
    agentCache.delete(id);
    return null;
  }
  return entry.value;
}

function cacheSet(agent: AgentRecord): void {
  agentCache.set(agent.id, { value: agent, expiresAt: Date.now() + TTL_MS });
}

function cacheDelete(id: string): void {
  agentCache.delete(id);
}

/** Exposed for testing — clears all cached entries. */
export function clearCache(): void {
  agentCache.clear();
}

// ---------------------------------------------------------------------------
// Soroban helpers
// ---------------------------------------------------------------------------

function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
}

async function submitTx(
  server: SorobanRpc.Server,
  tx: ReturnType<TransactionBuilder['build']>
): Promise<SorobanRpc.Api.GetSuccessfulTransactionResponse> {
  const preparedTx = await server.prepareTransaction(tx);
  const result = await server.sendTransaction(preparedTx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${result.errorResult}`);
  }

  // Poll for confirmation
  let response: SorobanRpc.Api.GetTransactionResponse;
  do {
    await new Promise((r) => setTimeout(r, 1000));
    response = await server.getTransaction(result.hash);
  } while (response.status === 'NOT_FOUND');

  if (response.status !== 'SUCCESS') {
    throw new Error(`Transaction failed with status: ${response.status}`);
  }

  return response as SorobanRpc.Api.GetSuccessfulTransactionResponse;
}

async function buildContractTx(
  server: SorobanRpc.Server,
  sourceKeypair: Keypair,
  method: string,
  args: xdr.ScVal[]
): Promise<ReturnType<TransactionBuilder['build']>> {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  return tx;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register an agent on-chain via Soroban.
 * Also stores the agent in the local TTL cache.
 */
export async function registerAgent(
  agent: AgentRecord,
  signerKeypair?: Keypair
): Promise<void> {
  // Update local cache immediately (optimistic)
  cacheSet({ ...agent, registeredAt: Date.now() });

  if (!CONTRACT_ID || !signerKeypair) return; // unit-test / offline mode

  const server = getServer();
  const args = [
    nativeToScVal(agent.id, { type: 'string' }),
    nativeToScVal(agent.capability, { type: 'string' }),
    nativeToScVal(agent.priceXLM, { type: 'i128' }),
    nativeToScVal(agent.endpoint ?? '', { type: 'string' }),
  ];
  const tx = await buildContractTx(server, signerKeypair, 'register_agent', args);
  tx.sign(signerKeypair);
  await submitTx(server, tx);
}

/**
 * Look up agents by capability.
 * Returns cached agents when available and not expired.
 */
export async function lookupAgent(
  capability: Capability,
  signerKeypair?: Keypair
): Promise<AgentRecord[]> {
  // Return from cache when populated
  const cached = Array.from(agentCache.values())
    .filter((e) => Date.now() <= e.expiresAt && e.value.capability === capability)
    .map((e) => e.value);

  if (cached.length > 0) return cached;

  if (!CONTRACT_ID || !signerKeypair) return [];

  const server = getServer();
  const args = [nativeToScVal(capability, { type: 'string' })];
  const tx = await buildContractTx(server, signerKeypair, 'lookup_agents', args);
  tx.sign(signerKeypair);
  const response = await submitTx(server, tx);

  const agents: AgentRecord[] = scValToNative(
    response.returnValue as xdr.ScVal
  ) as AgentRecord[];

  agents.forEach(cacheSet);
  return agents;
}

/**
 * Synchronous in-memory agent discovery (used by the existing test harness).
 * Returns all cached agents that match the given capability.
 */
export function discoverAgents(capability: Capability): AgentRecord[] {
  return Array.from(agentCache.values())
    .filter((e) => Date.now() <= e.expiresAt && e.value.capability === capability)
    .map((e) => e.value);
}

/**
 * Retrieve a single agent by id from the local cache.
 */
export function getAgent(id: string): AgentRecord | null {
  return cacheGet(id);
}

/**
 * Remove an agent from the registry on-chain.
 * Requires the keypair that originally registered the agent.
 */
export async function deregisterAgent(
  agentId: string,
  signerKeypair: Keypair
): Promise<void> {
  cacheDelete(agentId);

  if (!CONTRACT_ID) return;

  const server = getServer();
  const args = [nativeToScVal(agentId, { type: 'string' })];
  const tx = await buildContractTx(server, signerKeypair, 'deregister_agent', args);
  tx.sign(signerKeypair);
  await submitTx(server, tx);
}

/**
 * Update the service price for a registered agent on-chain.
 * Emits a Soroban `price_updated` event readable off-chain.
 * Requires the keypair that originally registered the agent.
 */
export async function updatePricing(
  agentId: string,
  newPriceXLM: number,
  signerKeypair: Keypair
): Promise<RegistryEvent> {
  // Optimistic cache update
  const existing = cacheGet(agentId);
  if (existing) cacheSet({ ...existing, priceXLM: newPriceXLM });

  const event: RegistryEvent = {
    type: 'price_updated',
    agentId,
    timestamp: Date.now(),
    data: { newPriceXLM },
  };

  if (!CONTRACT_ID) return event;

  const server = getServer();
  const args = [
    nativeToScVal(agentId, { type: 'string' }),
    nativeToScVal(newPriceXLM, { type: 'i128' }),
  ];
  const tx = await buildContractTx(server, signerKeypair, 'update_pricing', args);
  tx.sign(signerKeypair);
  await submitTx(server, tx);

  return event;
}
