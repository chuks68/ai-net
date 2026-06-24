/**
 * BaseAgent - Abstract base class shared by all agent implementations.
 * 
 * Provides common functionality for Venice AI integration, health checks,
 * registration, and error handling patterns.
 */

import { z } from 'zod';
import { VeniceClient, VeniceUnavailableError } from '../research/veniceClient';

export interface BaseAgentConfig {
  /** Injected VeniceClient; defaults to reading VENICE_API_KEY from process.env. */
  veniceClient?: VeniceClient;
  /** Base URL of the internal API server used for self-registration. */
  apiBaseUrl?: string;
  /** Unique stable ID for this agent instance. */
  agentId?: string;
}

export interface AgentTask {
  taskId: string;
  nodeId: string;
  prompt: string;
  context?: string;
  upstreamResults?: unknown[];
}

export interface AgentError {
  error: string;
}

export abstract class BaseAgent {
  protected readonly venice: VeniceClient;
  protected readonly apiBaseUrl: string;
  protected readonly agentId: string;

  constructor(config: BaseAgentConfig = {}) {
    if (config.veniceClient) {
      this.venice = config.veniceClient;
    } else {
      const apiKey = process.env['VENICE_API_KEY'];
      if (!apiKey) {
        console.warn(
          `[${this.constructor.name}] WARNING: VENICE_API_KEY is not set. ` +
            'Venice calls will fail. Set this env var before running in production.'
        );
      }
      this.venice = new VeniceClient({ apiKey: apiKey ?? '' });
    }
    this.apiBaseUrl = config.apiBaseUrl ?? 'http://127.0.0.1:3001';
    this.agentId = config.agentId ?? `${this.getCapability()}-agent-1`;
  }

  /**
   * Abstract method to execute a task - must be implemented by subclasses.
   */
  abstract execute(task: AgentTask): Promise<unknown | AgentError>;

  /**
   * Abstract method to return the agent's capability - must be implemented by subclasses.
   */
  abstract getCapability(): string;

  /**
   * Abstract method to get the agent's output schema - must be implemented by subclasses.
   */
  abstract getOutputSchema(): z.ZodSchema;

  /**
   * Health check - returns false (not throws) on Venice failure.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.venice.chat([
        { role: 'user', content: 'Hello' }
      ]);
      return true;
    } catch (err) {
      if (err instanceof VeniceUnavailableError) {
        return false;
      }
      console.error(`[${this.constructor.name}] Unexpected error in healthCheck:`, err instanceof Error ? err.message : 'unknown');
      return false;
    }
  }

  /**
   * Self-register this agent with the registry.
   */
  async register(): Promise<void> {
    const body = JSON.stringify({
      agentId: this.agentId,
      capabilities: [this.getCapability()],
      pricingXLM: 0.5,
      endpoint: `${this.apiBaseUrl}/agents/${this.getCapability()}`,
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
          `[${this.constructor.name}] Registration returned non-2xx status: ${response.status}`
        );
      } else {
        console.info(`[${this.constructor.name}] Successfully registered with capability "${this.getCapability()}".`);
      }
    } catch (err) {
      console.warn(`[${this.constructor.name}] Could not reach registry to self-register:`, err instanceof Error ? err.message : 'unknown');
    }
  }

  /**
   * Validate Venice response using the agent's output schema.
   */
  protected validateOutput(raw: unknown): unknown | null {
    const result = this.getOutputSchema().safeParse(raw);
    return result.success ? result.data : null;
  }

  /**
   * Parse JSON from Venice response, handling potential markdown wrappers.
   */
  protected parseJsonResponse(raw: string): unknown | null {
    if (typeof raw !== 'string') {
      return null;
    }
    
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  /**
   * Call Venice AI with retry logic for malformed JSON responses.
   */
  protected async callVeniceWithRetry(
    systemPrompt: string,
    userContent: string,
    jsonModeAddendum: string
  ): Promise<unknown | AgentError> {
    // First attempt
    let rawText: string;
    try {
      rawText = await this.venice.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]);
    } catch (err) {
      if (err instanceof VeniceUnavailableError) {
        return { error: 'VENICE_UNAVAILABLE' };
      }
      console.error(`[${this.constructor.name}] Unexpected error calling Venice:`, err instanceof Error ? err.message : 'unknown');
      return { error: 'VENICE_UNAVAILABLE' };
    }

    const parsed = this.parseJsonResponse(rawText);
    if (parsed !== null) {
      const validated = this.validateOutput(parsed);
      if (validated !== null) {
        return validated;
      }
    }

    // Retry with JSON mode addendum
    try {
      const retryText = await this.venice.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent + jsonModeAddendum },
      ]);

      const retryParsed = this.parseJsonResponse(retryText);
      if (retryParsed !== null) {
        const retryValidated = this.validateOutput(retryParsed);
        if (retryValidated !== null) {
          return retryValidated;
        }
      }
    } catch (err) {
      if (err instanceof VeniceUnavailableError) {
        return { error: 'VENICE_UNAVAILABLE' };
      }
      console.error(`[${this.constructor.name}] Unexpected error on Venice retry:`, err instanceof Error ? err.message : 'unknown');
      return { error: 'VENICE_UNAVAILABLE' };
    }

    return { error: 'VENICE_MALFORMED_RESPONSE' };
  }
}
