import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext'
import AppShell from './components/layout/AppShell'
import LandingPage from './pages/LandingPage'
import AgentsPage from './pages/AgentsPage'
import NewTaskPage from './pages/tasks/NewTaskPage'
import TaskDetailPage from './pages/TaskDetailPage'
import RendererDemoPage from './pages/RendererDemoPage'
import WalletPage from './pages/WalletPage'

const AppContent: React.FC = () => {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tasks/new" element={<NewTaskPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/renderer-demo" element={<RendererDemoPage />} />
        </Routes>
      </AppShell>
    </Router>
  )
}

const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  )
}

export default App
