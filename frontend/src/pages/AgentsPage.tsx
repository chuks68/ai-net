import React, { useState, useEffect } from 'react'
import { getAgents } from '@services/api'
import type { AgentRecord } from '../types/api'

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAgents()
      .then((data) => {
        setAgents(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading agents')
        setLoading(false)
      })
  }, [])

  return (
    <div className="glass-panel">
      <h1 style={{ marginBottom: '20px', fontSize: '1.8rem' }}>Agent Registry</h1>
      
      {loading ? (
        <div id="loading-spinner">Loading registry...</div>
      ) : error ? (
        <div className="error-msg" id="registry-error">{error}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table id="agent-table">
            <thead>
              <tr>
                <th>Agent ID</th>
                <th>Name</th>
                <th>Capabilities</th>
                <th>Price (XLM)</th>
                <th>Reputation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="agent-row" data-testid={`agent-row-${agent.id}`}>
                  <td style={{ fontFamily: 'monospace' }}>{agent.id}</td>
                  <td>{agent.name}</td>
                  <td>
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="chip" style={{ marginRight: '6px', fontSize: '0.75rem' }}>
                        {cap}
                      </span>
                    ))}
                  </td>
                  <td>{agent.price}</td>
                  <td>{agent.reputation}/5</td>
                  <td>
                    <span
                      style={{
                        color: agent.status === 'active' ? 'var(--success)' : 'var(--danger)',
                        fontWeight: 'bold',
                      }}
                    >
                      {agent.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AgentsPage
