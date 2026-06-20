import axios from 'axios';

const MODEL_ROUTING: Record<string, string> = {
  research: 'venice-xl',
  risk: 'venice-xl',
  coding: 'venice-code',
  design: 'venice-xl',
  report: 'venice-xl',
};

export class VeniceClient {
  constructor(private readonly apiKey = process.env.VENICE_API_KEY ?? '') {}

  getModelForAgent(capability: string): string {
    return MODEL_ROUTING[capability] ?? 'venice-xl';
  }

  async complete(prompt: string, capability = 'report'): Promise<string> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error('VENICE_API_KEY is not configured');
    }

    const response = await axios.post(
      'https://api.venice.ai/api/v1/chat/completions',
      {
        model: this.getModelForAgent(capability),
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Venice returned an empty response');
    }

    return content;
  }
}
