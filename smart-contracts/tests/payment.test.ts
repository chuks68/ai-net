import { Keypair } from '@stellar/stellar-sdk';
import axios from 'axios';
import {
  lockEscrow,
  releasePayment,
  refundEscrow,
  getEscrowBalance,
  EscrowAlreadySettledError,
  xlmToStroops,
  stroopsToXlm,
} from '../src/payment/payment';

jest.setTimeout(180000); // 3 minutes timeout for testnet network operations

describe('BigInt Stroop Conversion Calculations', () => {
    it('correctly parses integer XLM amounts to stroops', () => {
      expect(xlmToStroops('1')).toBe(10000000n);
      expect(xlmToStroops(10)).toBe(100000000n);
      expect(xlmToStroops(100n)).toBe(1000000000n);
    });

    it('correctly parses floating point XLM amounts to stroops without precision loss', () => {
      expect(xlmToStroops('10.5')).toBe(105000000n);
      expect(xlmToStroops('0.0000001')).toBe(1n);
    });

    it('correctly converts stroops to formatted XLM string representations', () => {
      expect(stroopsToXlm(10000000n)).toBe('1.0000000');
      expect(stroopsToXlm(105000000n)).toBe('10.5000000');
      expect(stroopsToXlm(1n)).toBe('0.0000001');
    });
});

const describeIntegration =
  process.env.RUN_STELLAR_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Stellar Payment Layer Escrow Integration Tests', () => {
  let coordinatorKeypair: Keypair;
  let agentKeypair: Keypair;
  let taskId: string;

  beforeAll(async () => {
    // Generate a fresh keypair for coordinator and agent
    coordinatorKeypair = Keypair.random();
    agentKeypair = Keypair.random();
    taskId = `task_${Math.floor(Math.random() * 1000000000)}`;

    // Set environment variables required by getEscrowBalance
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_SECRET_KEY = coordinatorKeypair.secret();
    process.env.STELLAR_COORDINATOR_PUBLIC_KEY = coordinatorKeypair.publicKey();

    // Fund coordinator and agent accounts using Stellar Friendbot
    const friendbotUrl1 = `https://friendbot.stellar.org/?addr=${coordinatorKeypair.publicKey()}`;
    const friendbotUrl2 = `https://friendbot.stellar.org/?addr=${agentKeypair.publicKey()}`;
    await Promise.all([axios.get(friendbotUrl1), axios.get(friendbotUrl2)]);
  });

  describe('Escrow Lock, Release, and Balance Cycle', () => {
    const amountXLM = '5.0000000';

    it('creates a claimable balance on Stellar testnet and queries its balance', async () => {
      // 1. Lock funds
      const lockTxHash = await lockEscrow(
        coordinatorKeypair,
        agentKeypair.publicKey(),
        amountXLM,
        taskId
      );
      expect(lockTxHash).toBeDefined();
      expect(typeof lockTxHash).toBe('string');

      // 2. Query balance (should return 5.0)
      const balance = await getEscrowBalance(taskId);
      expect(balance).toBe(5.0);

      // 3. Release funds
      const releaseTxHash = await releasePayment(
        coordinatorKeypair,
        agentKeypair.publicKey(),
        taskId
      );
      expect(releaseTxHash).toBeDefined();
      expect(typeof releaseTxHash).toBe('string');

      // 4. Query balance again (should be 0 because it is settled)
      const afterBalance = await getEscrowBalance(taskId);
      expect(afterBalance).toBe(0);

      // 5. Try release again; should throw EscrowAlreadySettledError
      await expect(
        releasePayment(coordinatorKeypair, agentKeypair.publicKey(), taskId)
      ).rejects.toThrow(EscrowAlreadySettledError);
    });
  });

  describe('Escrow Refund Cycle', () => {
    const refundTaskId = `task_${Math.floor(Math.random() * 1000000000)}`;
    const amountXLM = '3.5';

    it('refunds coordinator and prevents duplicate claims', async () => {
      // 1. Lock funds
      const lockTxHash = await lockEscrow(
        coordinatorKeypair,
        agentKeypair.publicKey(),
        amountXLM,
        refundTaskId
      );
      expect(lockTxHash).toBeDefined();

      // 2. Verify balance
      const balance = await getEscrowBalance(refundTaskId);
      expect(balance).toBe(3.5);

      // 3. Refund funds
      const refundTxHash = await refundEscrow(coordinatorKeypair, refundTaskId);
      expect(refundTxHash).toBeDefined();

      // 4. Verify balance is 0
      const afterBalance = await getEscrowBalance(refundTaskId);
      expect(afterBalance).toBe(0);

      // 5. Release should fail since it was refunded (settled)
      await expect(
        releasePayment(coordinatorKeypair, agentKeypair.publicKey(), refundTaskId)
      ).rejects.toThrow(EscrowAlreadySettledError);
    });
  });
});
