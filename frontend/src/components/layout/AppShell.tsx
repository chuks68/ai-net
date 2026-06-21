import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import MobileDrawer from './MobileDrawer'
import Breadcrumb from './Breadcrumb'
import './AppShell.css'

interface AppShellProps {
  children: React.ReactNode
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem('sidebar_collapsed') === 'true'
  )
  const location = useLocation()
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsDrawerOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsDrawerOpen(false)
      }
    }

    if (isDrawerOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDrawerOpen])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen)
  }

  return (
    <div className="app-shell">
      <TopNav 
        onMenuClick={toggleDrawer}
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        isMobile={isMobile}
        isDrawerOpen={isDrawerOpen}
      />
      
      {!isMobile && (
        <Sidebar 
          collapsed={sidebarCollapsed}
          currentPath={location.pathname}
          onNavigate={navigate}
        />
      )}

      <AnimatePresence>
        {isMobile && isDrawerOpen && (
          <MobileDrawer
            ref={drawerRef}
            onClose={() => setIsDrawerOpen(false)}
            currentPath={location.pathname}
            onNavigate={(path) => {
              navigate(path)
              setIsDrawerOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      <main className={`main-content ${!isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Breadcrumb />
        {children}
      </main>
    </div>
  )
}

export default AppShell
