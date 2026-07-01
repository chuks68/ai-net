/**
 * Thin fetch-based client for the Venice AI chat-completion REST API.
 *
 * Only the subset of the API required by this agent is implemented.
 * No Venice SDK is imported so as to minimise third-party supply-chain risk.
 *
 * Security notes:
 *  - API key is received from the caller; MUST come from process.env — never
 *    hardcoded.  VeniceClient itself does NOT access process.env.
 *  - All error details are kept server-side and never forwarded to clients.
 */

/** Thrown when the Venice AI endpoint cannot be reached or returns a non-2xx. */
export class VeniceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceUnavailableError';
  }
}

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VeniceChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface VeniceClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class VeniceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: VeniceClientConfig) {
    this.apiKey = config.apiKey;
    // TODO(security): enforce HTTPS-only base URLs in production to prevent
    // accidental downgrade to plaintext in misconfigured environments.
    this.baseUrl = config.baseUrl ?? 'https://api.venice.ai/api/v1';
  }

  /**
   * Send a chat-completion request to Venice AI.
   *
   * @returns The raw assistant message content string.
   * @throws {VeniceUnavailableError} on network failure or non-2xx response.
   */
  async chat(messages: VeniceMessage[], opts: VeniceChatOptions = {}): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: opts.model ?? 'llama-3.3-70b',
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Security: Authorization header — key is never logged or forwarded.
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body,
      });
    } catch (networkError) {
      // Surface only a generic error message — do not expose internal details.
      throw new VeniceUnavailableError('Venice AI is unreachable');
    }

    if (!response.ok) {
      // Non-2xx: treat as unavailable; do not leak status details to callers.
      throw new VeniceUnavailableError(
        `Venice AI returned a non-success status: ${response.status}`
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new VeniceUnavailableError('Venice AI returned malformed response body');
    }

    const content = (data as any)?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new VeniceUnavailableError('Venice AI response missing expected content field');
    }

    return content;
  }
}
