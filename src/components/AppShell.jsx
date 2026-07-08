import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Quarter context — shared across all pages ──────────────────────────────
export const QtrContext = createContext({ qtr: 'all', setQtr: () => {} })
export function useQtr() { return useContext(QtrContext) }

const NAV = [
  { to: '/',               icon: '▦', label: 'Overview' },
  { to: '/error-rate',     icon: '✎', label: 'Error Rate' },
  { to: '/delayed-entry',  icon: '⏱', label: 'Invoice TAT' },
  { to: '/invoices',       icon: '🗂', label: 'Invoice Log' },
  { to: '/upload',         icon: '↑', label: 'Upload CSV' },
  { to: '/admin',          icon: '⚙', label: 'Admin' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [qtr,      setQtr]     = useState('all')
  const [quarters, setQuarters] = useState([])

  useEffect(() => {
    // Fetch available quarters from the three primary source tables.
    Promise.all([
      supabase.from('ap_voucher_add').select('quarter').not('quarter','is',null).limit(1000),
      supabase.from('ap_voucher_modify').select('quarter').not('quarter','is',null).limit(1000),
      supabase.from('ap_invoice_data').select('quarter').not('quarter','is',null).limit(1000),
    ]).then(([add, mod, inv]) => {
      const all = [...(add.data || []), ...(mod.data || []), ...(inv.data || [])].map(r => r.quarter).filter(Boolean)
      const unique = [...new Set(all)].sort()
      setQuarters(unique)
    })
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <QtrContext.Provider value={{ qtr, setQtr }}>
      <div className="app-shell">
        <header className="header">
          <div className="header-brand">
            <span className="header-logo">SAADAA</span>
            <span className="header-sep">·</span>
            <span className="header-title">AP KPI Dashboard</span>
          </div>
          <div className="header-right">
            {quarters.length > 0 && (
              <div className="qtr-selector">
                <button className={`qtr-btn ${qtr === 'all' ? 'active' : ''}`} onClick={() => setQtr('all')}>All</button>
                {quarters.map(q => (
                  <button key={q} className={`qtr-btn ${qtr === q ? 'active' : ''}`} onClick={() => setQtr(q)}>
                    {q.replace(/(\d{4})Q(\d)/, (_, yr, qn) => `Q${qn}'${yr.slice(-2)}`)}
                  </button>
                ))}
              </div>
            )}
            <span className="header-user">{user?.email}</span>
          </div>
        </header>

        <div className="layout">
          <nav className="sidenav">
            <div className="sidenav-label">Menu</div>
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
            <div className="sidenav-bottom">
              <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
            </div>
          </nav>

          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </QtrContext.Provider>
  )
}
