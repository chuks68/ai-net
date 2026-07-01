import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, PlusCircle, Bot, Wallet } from 'lucide-react'
import './MobileDrawer.css'

interface MobileDrawerProps {
  onClose: () => void
  currentPath: string
  onNavigate: (path: string) => void
}

const MobileDrawer = forwardRef<HTMLDivElement, MobileDrawerProps>(({ 
  onClose, 
  currentPath, 
  onNavigate 
}, ref) => {
  const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/tasks/new', icon: <PlusCircle size={20} />, label: 'New Task' },
    { path: '/agents', icon: <Bot size={20} />, label: 'Agents' },
    { path: '/wallet', icon: <Wallet size={20} />, label: 'Wallet' },
  ]

  const handleKeyDown = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onNavigate(path)
    }
  }

  return (
    <>
      <motion.div
        className="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        className="mobile-drawer"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        role="navigation"
        aria-label="Mobile navigation menu"
      >
        <div className="drawer-header">
          <h2>Navigation</h2>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>
        
        <nav className="drawer-nav">
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
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </motion.div>
    </>
  )
})

MobileDrawer.displayName = 'MobileDrawer'

export default MobileDrawer
