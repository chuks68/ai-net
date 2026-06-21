import {
  Keypair,
  Server,
  TransactionBuilder,
  Operation,
  Asset,
  Claimant,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import type { PaymentDb, PaymentRecord } from "../db/index";
import {
  PaymentAlreadyReleasedError,
  HorizonUnavailableError,
  xlmToStroops,
  stroopsToXlm,
} from "./utils";

const STELLAR_HORIZON =
  process.env.STELLAR_HORIZON ?? "https://horizon-testnet.stellar.org";
const STELLAR_NETWORK =
  process.env.STELLAR_NETWORK ?? Networks.TESTNET;
const MAX_RETRIES = 5;

function isRetryable(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? "";
  // Horizon error codes for TIMEOUT and TOO_MANY_REQUESTS
  const extras = (
    err as {
      response?: { data?: { extras?: { result_codes?: { transaction?: string } } } };
    }
  )?.response?.data?.extras?.result_codes?.transaction ?? "";
  return (
    message.includes("TIMEOUT") ||
    message.includes("TOO_MANY_REQUESTS") ||
    message.includes("504") ||
    message.includes("429") ||
    extras === "tx_too_late"
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (!isRetryable(err) || attempt >= MAX_RETRIES) {
        if (isRetryable(err)) throw new HorizonUnavailableError(MAX_RETRIES);
        throw err;
      }
      await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
    }
  }
}

export class PaymentService {
  private server: Server;

  constructor(private db: PaymentDb) {
    this.server = new Server(STELLAR_HORIZON);
  }

  async lock(
    taskId: string,
    nodeId: string,
    coordinatorKeypair: Keypair,
    agentPublicKey: string,
    amountXLM: number
  ): Promise<string> {
    const amountStroops = xlmToStroops(amountXLM);
    const amountStr = stroopsToXlm(amountStroops);

    const account = await withRetry(() =>
      this.server.loadAccount(coordinatorKeypair.publicKey())
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        Operation.createClaimableBalance({
          asset: Asset.native(),
          amount: amountStr,
          claimants: [
            new Claimant(agentPublicKey, Claimant.predicateUnconditional()),
            new Claimant(coordinatorKeypair.publicKey(), Claimant.predicateUnconditional()),
          ],
        })
      )
      .setTimeout(30)
      .build();

    // Derive balance ID before signing — deterministic from the operation
    const balanceId = tx.getClaimableBalanceId(0);

    // Pre-write a pending record BEFORE submitting to Stellar.
    // If the DB write fails here, no funds are moved — safe to retry.
    // If the Stellar submit fails, the pending record is a no-op and can be
    // cleaned up on next attempt. This prevents funds being stranded when the
    // submit succeeds but the subsequent DB write would have failed.
    this.db.insert({
      taskId,
      nodeId,
      balanceId,
      status: "pending",
      amountStroops,
      txHash: null,
    });

    tx.sign(coordinatorKeypair);

    await withRetry(() => this.server.submitTransaction(tx));

    this.db.updateStatus(taskId, nodeId, "locked", null);

    return balanceId;
  }

  async release(
    taskId: string,
    nodeId: string,
    coordinatorKeypair: Keypair
  ): Promise<string> {
    const record = this.db.findByKey(taskId, nodeId);
    if (!record) throw new Error(`No payment record for task=${taskId} node=${nodeId}`);

    // Idempotency: return existing hash without a second Stellar tx
    if (record.status === "released" && record.txHash) {
      return record.txHash;
    }

    const account = await withRetry(() =>
      this.server.loadAccount(coordinatorKeypair.publicKey())
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        Operation.claimClaimableBalance({ balanceId: record.balanceId })
      )
      .setTimeout(30)
      .build();

    tx.sign(coordinatorKeypair);

    const result = await withRetry(() => this.server.submitTransaction(tx));
    const txHash = (result as unknown as { hash: string }).hash;

    this.db.updateStatus(taskId, nodeId, "released", txHash);
    return txHash;
  }

  async refund(
    taskId: string,
    nodeId: string,
    coordinatorKeypair: Keypair
  ): Promise<string> {
    const record = this.db.findByKey(taskId, nodeId);
    if (!record) throw new Error(`No payment record for task=${taskId} node=${nodeId}`);

    if (record.status === "released") {
      throw new PaymentAlreadyReleasedError(taskId, nodeId);
    }

    // Idempotency: if already refunded, return existing hash without a second Stellar tx
    if (record.status === "refunded" && record.txHash) {
      return record.txHash;
    }

    const account = await withRetry(() =>
      this.server.loadAccount(coordinatorKeypair.publicKey())
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        Operation.claimClaimableBalance({ balanceId: record.balanceId })
      )
      .setTimeout(30)
      .build();

    tx.sign(coordinatorKeypair);

    const result = await withRetry(() => this.server.submitTransaction(tx));
    const txHash = (result as unknown as { hash: string }).hash;

    this.db.updateStatus(taskId, nodeId, "refunded", txHash);
    return txHash;
  }

  getPaymentStatus(taskId: string, nodeId: string): PaymentRecord | undefined {
    return this.db.findByKey(taskId, nodeId);
  }
}
