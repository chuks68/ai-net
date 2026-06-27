/**
 * Unit tests for RiskAgent
 */

import { RiskAgent } from '../../../src/agents/risk/risk';
import { VeniceClient, VeniceUnavailableError } from '../../../src/agents/research/veniceClient';

describe('RiskAgent', () => {
  let mockVeniceClient: jest.Mocked<VeniceClient>;
  let agent: RiskAgent;

  beforeEach(() => {
    mockVeniceClient = {
      chat: jest.fn(),
    } as any;

    agent = new RiskAgent({
      veniceClient: mockVeniceClient,
      apiBaseUrl: 'http://test.local',
      agentId: 'test-risk-agent',
    });
  });

  describe('execute - normal path', () => {
    it('should process valid risk assessment and mark critical risks', async () => {
      const mockResponse = {
        risks: [
          {
            category: 'Market',
            description: 'High competition risk',
            likelihood: 5,
            impact: 4,
            mitigations: ['Market research', 'Differentiation strategy'],
          },
          {
            category: 'Technical',
            description: 'Low scalability concern',
            likelihood: 2,
            impact: 3,
            mitigations: ['Code review', 'Performance testing'],
          },
        ],
        overallRiskScore: 3.5,
      };

      mockVeniceClient.chat.mockResolvedValueOnce(JSON.stringify(mockResponse));

      const result = await agent.execute({
        taskId: 'task-1',
        nodeId: 'risk-node',
        prompt: 'Analyze market entry risks for solar energy',
      });

      expect(result).toEqual({
        risks: [
          {
            ...mockResponse.risks[0],
            critical: true, // likelihood 5 >= 4 AND impact 4 >= 4
          },
          {
            ...mockResponse.risks[1],
            critical: false, // likelihood 2 < 4
          },
        ],
        overallRiskScore: 3.5,
      });
    });

    it('should mark risks as critical when likelihood >= 4 AND impact >= 4', async () => {
      const mockResponse = {
        risks: [
          {
            category: 'High Risk',
            description: 'Critical risk item',
            likelihood: 4,
            impact: 4,
            mitigations: ['Immediate action'],
          },
        ],
        overallRiskScore: 4.0,
      };

      mockVeniceClient.chat.mockResolvedValueOnce(JSON.stringify(mockResponse));

      const result = await agent.execute({
        taskId: 'task-1',
        nodeId: 'risk-node',
        prompt: 'Test critical risk',
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.risks[0].critical).toBe(true);
      }
    });
  });

  describe('execute - Zod validation failure', () => {
    it('should return VENICE_MALFORMED_RESPONSE on invalid schema', async () => {
      const invalidResponse = {
        invalidField: 'invalid data',
      };

      mockVeniceClient.chat
        .mockResolvedValueOnce(JSON.stringify(invalidResponse))
        .mockResolvedValueOnce(JSON.stringify(invalidResponse)); // retry also fails

      const result = await agent.execute({
        taskId: 'task-1',
        nodeId: 'risk-node',
        prompt: 'Test invalid response',
      });

      expect(result).toEqual({ error: 'VENICE_MALFORMED_RESPONSE' });
    });
  });

  describe('execute - Venice failure', () => {
    it('should return VENICE_UNAVAILABLE on VeniceUnavailableError', async () => {
      mockVeniceClient.chat.mockRejectedValueOnce(
        new VeniceUnavailableError('Service unavailable')
      );

      const result = await agent.execute({
        taskId: 'task-1',
        nodeId: 'risk-node',
        prompt: 'Test Venice failure',
      });

      expect(result).toEqual({ error: 'VENICE_UNAVAILABLE' });
    });

    it('should return VENICE_UNAVAILABLE on unexpected error', async () => {
      mockVeniceClient.chat.mockRejectedValueOnce(
        new Error('Unexpected network error')
      );

      const result = await agent.execute({
        taskId: 'task-1',
        nodeId: 'risk-node',
        prompt: 'Test unexpected error',
      });

      expect(result).toEqual({ error: 'VENICE_UNAVAILABLE' });
    });
  });

  describe('healthCheck', () => {
    it('should return true when Venice is available', async () => {
      mockVeniceClient.chat.mockResolvedValueOnce('Hello back');

      const result = await agent.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when Venice is unavailable', async () => {
      mockVeniceClient.chat.mockRejectedValueOnce(
        new VeniceUnavailableError('Service unavailable')
      );

      const result = await agent.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getCapability', () => {
    it('should return "risk"', () => {
      expect(agent.getCapability()).toBe('risk');
    });
  });
});
