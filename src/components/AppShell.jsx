import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/db'
import { rowFiscalQuarter } from '../lib/insights'

// ── Quarter context — shared across all pages ──────────────────────────────
const EMPTY_DATA = { add: [], mod: [], inv: [] }

export const QtrContext = createContext({
  qtr: 'all',
  setQtr: () => {},
  data: EMPTY_DATA,
  dataLoading: true,
  dataError: null,
  refreshData: () => {},
})
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
  const [data, setData] = useState(EMPTY_DATA)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState(null)

  async function loadPrimaryData() {
    setDataLoading(true)
    setDataError(null)
    try {
      const [add, mod, inv] = await Promise.all([
        fetchAllRows(() => supabase.from('ap_voucher_add').select('vch_no, entry_date, added_by, quarter, month_label, series, type')),
        fetchAllRows(() => supabase.from('ap_voucher_modify').select('vch_no, modified_at, modified_by, quarter, month_label, series, type')),
        fetchAllRows(() => supabase.from('ap_invoice_data').select('submitted_at, month_label, quarter, email, po_no, vendor_code, po_type, doc_type, invoice_no, invoice_date').not('submitted_at', 'is', null)),
      ])

      setData({ add, mod, inv })
      const all = [...add, ...mod, ...inv].map(rowFiscalQuarter).filter(Boolean)
      const unique = [...new Set(all)].sort()
      setQuarters(unique)
      if (qtr !== 'all' && !unique.includes(qtr)) setQtr('all')
    } catch (error) {
      console.error('Primary data load error:', error)
      setDataError(error)
      setData(EMPTY_DATA)
      setQuarters([])
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    loadPrimaryData()
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <QtrContext.Provider value={{ qtr, setQtr, data, dataLoading, dataError, refreshData: loadPrimaryData }}>
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
