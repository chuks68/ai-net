import axios from 'axios';

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VeniceClient {
  chat(messages: VeniceMessage[]): Promise<string>;
}

export function createVeniceClient(apiKey: string): VeniceClient {
  return {
    async chat(messages: VeniceMessage[]): Promise<string> {
      const response = await axios.post(
        'https://api.venice.ai/api/v1/chat/completions',
        { model: 'llama-3.3-70b', messages },
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      return response.data.choices[0].message.content as string;
    },
  };
}
