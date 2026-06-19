/**
 * ResearchAgent — calls Venice AI and returns structured research output.
 *
 * Implements the agent interface described in ISSUES.md #26.
 *
 * Security notes:
 *  - VENICE_API_KEY is read from process.env.  If missing the agent emits a
 *    clear warning and self-registers will fail gracefully.  No fallback
 *    literal is used.
 *    TODO(security): in production load API keys via a KMS / secret manager
 *    (e.g. HashiCorp Vault, AWS Secrets Manager) rather than environment vars.
 *  - Venice response is fully validated with Zod before any field is consumed.
 *  - Internal errors are never propagated raw; callers receive structured
 *    { error } payloads instead.
 *  - The self-registration call uses a plain HTTP POST to the local API server.
 *    TODO(security): when the registry endpoint enforces auth, add a signed
 *    challenge or shared internal token here.
 */

import { z } from 'zod';
import { VeniceClient, VeniceUnavailableError } from './veniceClient';
import type { AgentTask, AgentResult, AgentError, Source } from './types';

// ---------------------------------------------------------------------------
// Zod schema for the structured JSON Venice is asked to return.
// ---------------------------------------------------------------------------

const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
});

const VeniceResearchResponseSchema = z.object({
  summary: z.string().min(1),
  keyFindings: z.array(z.string()).min(1),
  sources: z.array(SourceSchema),
  // Venice's own confidence field is ignored for scoring; we recalculate it.
  confidence: z.number().min(0).max(1).optional(),
});

type VeniceResearchResponse = z.infer<typeof VeniceResearchResponseSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive deterministic confidence score from source count. */
export function deriveConfidence(sourceCount: number): number {
  if (sourceCount === 0) return 0.3;
  if (sourceCount <= 3) return 0.6;
  return 0.9;
}

const SYSTEM_PROMPT = `You are an expert research analyst. Your task is to \
research the given topic thoroughly and return ONLY a valid JSON object — no \
markdown, no prose, no code fences — with the following structure:
{
  "summary": "<one-paragraph executive summary>",
  "keyFindings": ["<finding 1>", "<finding 2>", ...],
  "sources": [
    { "url": "<source URL>", "title": "<source title>" },
    ...
  ],
  "confidence": <float between 0 and 1>
}
Be precise, factual, and cite verifiable sources where possible.`;

const JSON_MODE_ADDENDUM = `\n\nCRITICAL: Your previous response was not valid \
JSON. You MUST respond with ONLY a raw JSON object that matches this schema — \
no explanation, no markdown, no code blocks:
{
  "summary": "string",
  "keyFindings": ["string"],
  "sources": [{"url": "string", "title": "string"}],
  "confidence": number
}`;

// ---------------------------------------------------------------------------
// ResearchAgent
// ---------------------------------------------------------------------------

export interface ResearchAgentConfig {
  /** Injected VeniceClient; defaults to reading VENICE_API_KEY from process.env. */
  veniceClient?: VeniceClient;
  /** Base URL of the internal API server used for self-registration. */
  apiBaseUrl?: string;
  /** Unique stable ID for this agent instance. */
  agentId?: string;
}

export class ResearchAgent {
  private readonly venice: VeniceClient;
  private readonly apiBaseUrl: string;
  private readonly agentId: string;

  constructor(config: ResearchAgentConfig = {}) {
    if (config.veniceClient) {
      this.venice = config.veniceClient;
    } else {
      const apiKey = process.env['VENICE_API_KEY'];
      if (!apiKey) {
        // Emit a clear warning; the agent can still be constructed so tests
        // that inject a client are unaffected, but the register() call will
        // be a no-op if there is also no API server.
        console.warn(
          '[ResearchAgent] WARNING: VENICE_API_KEY is not set. ' +
            'Venice calls will fail. Set this env var before running in production.'
        );
      }
      this.venice = new VeniceClient({ apiKey: apiKey ?? '' });
    }
    this.apiBaseUrl = config.apiBaseUrl ?? 'http://127.0.0.1:3001';
    this.agentId = config.agentId ?? 'research-agent-1';
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Execute a research task.
   *
   * Returns a fully populated AgentResult on success, or an AgentError object
   * (NOT a thrown error) when Venice is unreachable.
   */
  async execute(task: AgentTask): Promise<AgentResult | AgentError> {
    const { taskId, nodeId, prompt, context } = task;

    const userContent = context
      ? `${prompt}\n\nAdditional context:\n${context}`
      : prompt;

    // First attempt
    let rawText: string;
    try {
      rawText = await this.venice.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ]);
    } catch (err) {
      if (err instanceof VeniceUnavailableError) {
        return { error: 'VENICE_UNAVAILABLE' };
      }
      // Unexpected error — treat as unavailable; do not throw.
      console.error('[ResearchAgent] Unexpected error calling Venice:', err instanceof Error ? err.message : 'unknown');
      return { error: 'VENICE_UNAVAILABLE' };
    }

    // Try to parse and validate the first response.
    const parsed = this.parseVeniceResponse(rawText);
    if (parsed !== null) {
      return this.buildResult(taskId, nodeId, parsed);
    }

    // ---- Retry once with explicit JSON-mode addendum ----
    let retryText: string;
    try {
      retryText = await this.venice.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent + JSON_MODE_ADDENDUM },
      ]);
    } catch (err) {
      if (err instanceof VeniceUnavailableError) {
        return { error: 'VENICE_UNAVAILABLE' };
      }
      console.error('[ResearchAgent] Unexpected error on Venice retry:', err instanceof Error ? err.message : 'unknown');
      return { error: 'VENICE_UNAVAILABLE' };
    }

    const retryParsed = this.parseVeniceResponse(retryText);
    if (retryParsed !== null) {
      return this.buildResult(taskId, nodeId, retryParsed);
    }

    // Both attempts failed to produce valid JSON.  Return a structured error
    // rather than throwing so the Coordinator can handle it gracefully.
    return { error: 'VENICE_MALFORMED_RESPONSE' };
  }

  /**
   * Self-register this agent with the registry.
   *
   * Called on startup.  Failures are logged but do not crash the process.
   */
  async register(): Promise<void> {
    const body = JSON.stringify({
      agentId: this.agentId,
      capabilities: ['research'],
      pricingXLM: 0.5,
      endpoint: `${this.apiBaseUrl}/agents/research`,
      // TODO(security): replace with a real Stellar public key from a
      // securely generated keypair stored outside source code.
      stellarPublicKey: process.env['STELLAR_PUBLIC_KEY'] ?? '',
    });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        console.warn(
          `[ResearchAgent] Registration returned non-2xx status: ${response.status}`
        );
      } else {
        console.info('[ResearchAgent] Successfully registered with capability "research".');
      }
    } catch (err) {
      // Registration failure must not crash the agent — the Coordinator may
      // still route tasks directly.
      console.warn('[ResearchAgent] Could not reach registry to self-register:', err instanceof Error ? err.message : 'unknown');
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Attempt to extract a JSON object from Venice output and validate it.
   * Returns null if parsing or validation fails.
   */
  private parseVeniceResponse(raw: string): VeniceResearchResponse | null {
    // Strip potential markdown code fences that Venice may wrap around JSON.
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      return null;
    }

    const result = VeniceResearchResponseSchema.safeParse(json);
    if (!result.success) {
      return null;
    }
    return result.data;
  }

  /** Build the canonical AgentResult from a validated Venice payload. */
  private buildResult(
    taskId: string,
    nodeId: string,
    data: VeniceResearchResponse
  ): AgentResult {
    const sources: Source[] = data.sources;
    return {
      taskId,
      nodeId,
      summary: data.summary,
      keyFindings: data.keyFindings,
      sources,
      // Confidence is always recalculated from source count — deterministic.
      confidence: deriveConfidence(sources.length),
    };
  }
}
