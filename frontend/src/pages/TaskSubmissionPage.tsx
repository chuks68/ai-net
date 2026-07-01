import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TaskSubmissionPage: React.FC = () => {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [maxBudgetXLM, setMaxBudgetXLM] = useState('1.0')
  const [agentPreferences, setAgentPreferences] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckboxChange = (cap: string) => {
    if (agentPreferences.includes(cap)) {
      setAgentPreferences(agentPreferences.filter((c) => c !== cap))
    } else {
      setAgentPreferences([...agentPreferences, cap])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          maxBudgetXLM: parseFloat(maxBudgetXLM),
          agentPreferences,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit task')
      }

      const data = await response.json()
      // Redirect to the live task monitoring page
      navigate(`/tasks/${data.taskId}`)
    } catch (err: any) {
      setError(err.message || 'Error submitting task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h1 style={{ marginBottom: '20px', fontSize: '1.8rem' }}>Submit New Task</h1>
      <form onSubmit={handleSubmit} id="task-form">
        <div className="form-group">
          <label htmlFor="prompt">Task Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the task you want the agent network to accomplish..."
            rows={5}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="maxBudgetXLM">Maximum Budget (XLM)</label>
          <input
            type="number"
            id="maxBudgetXLM"
            value={maxBudgetXLM}
            onChange={(e) => setMaxBudgetXLM(e.target.value)}
            min="0.1"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label>Agent Preferences</label>
          <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                value="research"
                checked={agentPreferences.includes('research')}
                onChange={() => handleCheckboxChange('research')}
                id="pref-research"
              />
              Research
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                value="coding"
                checked={agentPreferences.includes('coding')}
                onChange={() => handleCheckboxChange('coding')}
                id="pref-coding"
              />
              Coding
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                value="report"
                checked={agentPreferences.includes('report')}
                onChange={() => handleCheckboxChange('report')}
                id="pref-report"
              />
              Report
            </label>
          </div>
        </div>

        {error && (
          <div className="error-msg" id="task-error" style={{ marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <button type="submit" style={{ width: '100%' }} id="btn-submit-task" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Task'}
        </button>
      </form>
    </div>
  )
}

export default TaskSubmissionPage
