import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/',              icon: '▦', label: 'Overview' },
  { to: '/error-rate',    icon: '✎', label: 'Error Rate' },
  { to: '/delayed-entry', icon: '⏱', label: 'Delayed Entry' },
  { to: '/cost-savings',  icon: '₹', label: 'Cost Savings' },
  { to: '/invoices',      icon: '🗂', label: 'Invoice Log' },
  { to: '/upload',        icon: '↑', label: 'Upload CSV' },
  { to: '/admin',         icon: '⚙', label: 'Admin' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">SAADAA</span>
          <span className="header-title">AP KPI Dashboard</span>
        </div>
        <div className="header-right">
          <span className="header-user">{user?.email}</span>
        </div>
      </header>

      <div className="layout">
        <nav className="sidenav">
          <div className="sidenav-section">
            {NAV.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </div>
          <div className="sidenav-bottom">
            <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
