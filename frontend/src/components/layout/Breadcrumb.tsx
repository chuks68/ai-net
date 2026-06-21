import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import './Breadcrumb.css'

const Breadcrumb: React.FC = () => {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter(Boolean)

  const getBreadcrumbLabel = (path: string, index: number) => {
    const fullPath = '/' + pathnames.slice(0, index + 1).join('/')
    
    switch (fullPath) {
      case '/': return 'Dashboard'
      case '/tasks': return 'Tasks'
      case '/tasks/new': return 'New Task'
      case '/agents': return 'Agents'
      case '/wallet': return 'Wallet'
      default:
        if (fullPath.startsWith('/tasks/') && pathnames.length > 1) {
          return `Task ${pathnames[1]}`
        }
        return path.charAt(0).toUpperCase() + path.slice(1)
    }
  }

  if (pathnames.length === 0) {
    return null
  }

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">Dashboard</Link>
        </li>
        {pathnames.map((path, index) => {
          const fullPath = '/' + pathnames.slice(0, index + 1).join('/')
          const isLast = index === pathnames.length - 1
          const label = getBreadcrumbLabel(path, index)

          return (
            <li key={fullPath}>
              <span className="separator">/</span>
              {isLast ? (
                <span aria-current="page">{label}</span>
              ) : (
                <Link to={fullPath}>{label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb
