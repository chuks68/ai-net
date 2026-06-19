import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
  Claimant,
  Memo,
  NotFoundError,
  Account,
} from '@stellar/stellar-sdk';
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

// Setup Mock for Horizon Server methods
const mockLoadAccount = jest.fn();
const mockFetchBaseFee = jest.fn();
const mockTransactionsCall = jest.fn();
const mockClaimableBalanceCall = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        fetchBaseFee: mockFetchBaseFee,
        submitTransaction: mockSubmitTransaction,
        transactions: jest.fn().mockReturnValue({
          forAccount: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                call: mockTransactionsCall,
              }),
            }),
          }),
        }),
        claimableBalances: jest.fn().mockReturnValue({
          claimableBalance: jest.fn().mockReturnValue({
            call: mockClaimableBalanceCall,
          }),
        }),
      })),
    },
  };
});

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

  it('correctly handles zero and extreme/rounding edge cases', () => {
    expect(xlmToStroops('0')).toBe(0n);
    expect(xlmToStroops(0)).toBe(0n);
    expect(xlmToStroops('1.00000005')).toBe(10000000n); // sub-stroop precision is truncated
    expect(stroopsToXlm(0n)).toBe('0.0000000');
    expect(stroopsToXlm(1234567890123n)).toBe('123456.7890123');
  });
});

describe('Unit Tests with Mocked Horizon', () => {
  let coordinatorKeypair: Keypair;
  let agentKeypair: Keypair;
  let taskId: string;
  let envelopeXdr: string;
  let originalSetTimeout: any;

  beforeAll(() => {
    coordinatorKeypair = Keypair.random();
    agentKeypair = Keypair.random();
    taskId = 'task_mock_123';

    // Build a mock envelope XDR containing a CreateClaimableBalance op with the memo
    const account = new Account(coordinatorKeypair.publicKey(), '123');
    const claimants = [
      new Claimant(coordinatorKeypair.publicKey(), Claimant.predicateUnconditional()),
    ];
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.createClaimableBalance({
          asset: Asset.native(),
          amount: '10.0000000',
          claimants,
        })
      )
      .addMemo(Memo.text(taskId))
      .setTimeout(180)
      .build();
    tx.sign(coordinatorKeypair);
    envelopeXdr = tx.toEnvelope().toXDR('base64');

    // Speed up tests by skipping timeout delay
    originalSetTimeout = global.setTimeout;
    // @ts-ignore
    global.setTimeout = (fn: any) => fn();
  });

  afterAll(() => {
    global.setTimeout = originalSetTimeout;
  });

  beforeEach(() => {
    mockLoadAccount.mockReset();
    mockFetchBaseFee.mockReset();
    mockSubmitTransaction.mockReset();
    mockTransactionsCall.mockReset();
    mockClaimableBalanceCall.mockReset();

    // Set default resolutions using the imported Account class
    mockLoadAccount.mockImplementation((pubkey: string) => Promise.resolve(
      new Account(pubkey, '123')
    ));
    mockFetchBaseFee.mockResolvedValue(100);
    mockSubmitTransaction.mockResolvedValue({ hash: 'mock_tx_hash' });
    mockTransactionsCall.mockResolvedValue({ records: [] });
    mockClaimableBalanceCall.mockResolvedValue({ amount: '10.0000000' });
  });

  it('throws EscrowAlreadySettledError when releasePayment encounters a 404 from Horizon', async () => {
    // Mock getStellarConfig
    process.env.STELLAR_NETWORK = 'testnet';

    // Mock history to return the creation transaction
    mockTransactionsCall.mockResolvedValueOnce({
      records: [
        {
          memo_type: 'text',
          memo: taskId,
          envelope_xdr: envelopeXdr,
        },
      ],
    });

    // Mock claimableBalances call to return 404
    const err = new NotFoundError('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: {},
      data: {},
    });
    mockClaimableBalanceCall.mockRejectedValueOnce(err);

    await expect(
      releasePayment(coordinatorKeypair, agentKeypair.publicKey(), taskId)
    ).rejects.toThrow(EscrowAlreadySettledError);
  });

  it('retries up to 5 times on 429/504 status codes and then fails', async () => {
    // Mock loadAccount to fail with 429 status code
    const err429 = new Error('Rate limit exceeded');
    (err429 as any).response = {
      status: 429,
    };
    mockLoadAccount.mockRejectedValue(err429);

    await expect(
      lockEscrow(coordinatorKeypair, agentKeypair.publicKey(), '10.0000000', 'task_retry')
    ).rejects.toThrow('Rate limit exceeded');

    // Verify loadAccount was called 5 times due to retries
    expect(mockLoadAccount).toHaveBeenCalledTimes(5);
  });

  it('succeeds after transient errors resolve', async () => {
    // Mock loadAccount to fail twice with 504 (transient), then succeed
    const err504 = new Error('Gateway Timeout');
    (err504 as any).response = {
      status: 504,
    };
    mockLoadAccount
      .mockRejectedValueOnce(err504)
      .mockRejectedValueOnce(err504)
      .mockImplementationOnce((pubkey: string) => Promise.resolve(
        new Account(pubkey, '123')
      ));

    const hash = await lockEscrow(
      coordinatorKeypair,
      agentKeypair.publicKey(),
      '10.0000000',
      'task_success_retry'
    );

    expect(hash).toBe('mock_tx_hash');
    expect(mockLoadAccount).toHaveBeenCalledTimes(3);
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
