import express, { Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';

import { decompose } from '../coordinator/decompose';
import { executeDAG, type DispatchFn, type PaymentReleaseFn } from '../coordinator/coordinator';
import { createTask, getTask } from '../coordinator/taskStore';
import { eventBus } from '../coordinator/eventBus';
import { createEventStore, type EventStore } from '../coordinator/eventStore';
import { attachTaskStream, type TaskStreamOptions } from './routes/stream';
import { createPaymentReleaseFn, type StellarReleasePaymentFn } from '../payment';
import { agentsRouter } from './routes/agents';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { authMiddleware } from './middleware/auth';

export interface AppOptions {
  /** Called to execute a single DAG node; defaults to HTTP dispatch */
  dispatch?: DispatchFn;
  /** Called after each node completes; defaults to no-op (returns 'mock-hash') */
  releasePayment?: PaymentReleaseFn;
  /** Event log for stream replay; defaults to an in-memory SQLite store */
  eventStore?: EventStore;
  /** Heartbeat / auth timing for the WebSocket stream */
  stream?: TaskStreamOptions;
}

/**
 * Attempt to load smart-contracts releasePayment at runtime via dynamic require.
 * Returns undefined when the module is unavailable (e.g. backend CI without
 * smart-contracts compiled). Using require() instead of a static import keeps
 * TypeScript's rootDir constraint intact.
 */
function tryLoadStellarRelease(): StellarReleasePaymentFn | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../../smart-contracts/src/payment/payment').releasePayment as StellarReleasePaymentFn;
  } catch {
    return undefined;
  }
}

export function createApp(opts: AppOptions = {}): { httpServer: HttpServer; close: () => void } {
  const app = express();
  app.use(express.json());
  app.use('/api/agents', agentsRouter);

  const dispatch: DispatchFn = opts.dispatch ?? defaultDispatch;
  const releasePayment: PaymentReleaseFn =
    opts.releasePayment ?? createPaymentReleaseFn(tryLoadStellarRelease());

  // ── Agent routes ───────────────────────────────────────────────────────────
  app.use('/api/agents', createAgentsRouter());

  // ── POST /api/tasks ────────────────────────────────────────────────────────
  app.post('/api/tasks', authMiddleware, rateLimitMiddleware, (req: Request, res: Response) => {
    const { prompt, walletPublicKey } = req.body as {
      prompt?: string;
      walletPublicKey?: string;
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const taskId = `task_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const dag = decompose(taskId, prompt);
    const now = new Date().toISOString();

    createTask({
      taskId,
      prompt,
      walletPublicKey: walletPublicKey ?? 'anonymous',
      status: 'queued',
      dag,
      createdAt: now,
      updatedAt: now,
    });

    // Run the DAG asynchronously — do not await
    setImmediate(() => {
      executeDAG(getTask(taskId)!, dispatch, releasePayment).catch(err => {
        console.error('[coordinator] DAG execution error:', err);
      });
    });

    return res.status(201).json({ taskId, dagPreview: dag, status: 'queued' });
  });

  // ── GET /api/tasks/:id ─────────────────────────────────────────────────────
  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const task = getTask(req.params.id!);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  });

  // ── HTTP server ────────────────────────────────────────────────────────────
  const httpServer = createServer(app);

  // ── Event persistence ──────────────────────────────────────────────────────
  // Record every Coordinator event so a (re)connecting client can replay the
  // task's full history before live streaming begins.
  const eventStore = opts.eventStore ?? createEventStore();
  const stopRecording = eventBus.subscribeAll(event => eventStore.append(event));

  // ── WebSocket: /tasks/:id/stream ───────────────────────────────────────────
  const detachStream = attachTaskStream({
    httpServer,
    eventStore,
    eventBus,
    getTask,
    ...opts.stream,
  });

  function close(): void {
    detachStream();
    stopRecording();
    eventStore.close();
    httpServer.close();
  }

  return { httpServer, close };
}

async function defaultDispatch(
  taskId: string,
  node: { nodeId: string; agentType: string; prompt: string },
  context: string
): Promise<unknown> {
  // In production this POSTs to the agent's HTTP endpoint.
  // The e2e test replaces this via opts.dispatch.
  throw new Error(`No agent registered for type: ${node.agentType}`);
}
