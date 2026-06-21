import React from 'react'
import { LayoutDashboard, PlusCircle, Bot, Wallet } from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  collapsed: boolean
  currentPath: string
  onNavigate: (path: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  currentPath, 
  onNavigate 
}) => {
  const navItems = [
    { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/tasks/new', icon: <PlusCircle size={18} />, label: 'New Task' },
    { path: '/agents', icon: <Bot size={18} />, label: 'Agents' },
    { path: '/wallet', icon: <Wallet size={18} />, label: 'Wallet' },
  ]

  const handleKeyDown = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onNavigate(path)
    }
  }

  return (
    <aside 
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
    >
      <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
        <ul>
          {navItems.map((item) => {
            const isActive = currentPath === item.path
            return (
              <li key={item.path}>
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate(item.path)}
                  onKeyDown={(e) => handleKeyDown(e, item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
