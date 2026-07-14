import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Tag, Spinner, HelpButton } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const HELP = {
  title: 'Admin',
  terms: [
    { term: 'Viewer', meaning: 'Role intended for read-only users.' },
    { term: 'Uploader', meaning: 'Role allowed by Supabase RLS to insert and update uploaded CSV data.' },
    { term: 'Admin', meaning: 'Role allowed by Supabase RLS to manage user roles.' },
    { term: 'RLS', meaning: 'Row Level Security. Supabase policies enforce what users can read or write.' },
    { term: 'Pre-provisioned user', meaning: 'A role row can be created for an email before that person has logged in.' },
  ],
  formulas: [
    { name: 'Role lookup', formula: 'get_my_role() returns role from ap_user_roles, defaulting to viewer' },
    { name: 'SAADAA access check', formula: 'is_saadaa_user() allows authenticated emails ending with @saadaa.in' },
    { name: 'Grant role', formula: 'upsert role by email; user_id can remain empty until the user logs in' },
  ],
  notes: [
    'Client route guards are intentionally permissive; Supabase RLS is the real permission boundary.',
    'Removing a user deletes the dashboard role row, not the Supabase Auth user.',
  ],
}

async function runWithTimeout(query, ms = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await query.abortSignal(controller.signal)
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { data: null, error: new Error('Request timed out. Please try again.') }
    }
    return { data: null, error }
  } finally {
    clearTimeout(timer)
  }
}

export default function Admin() {
  const { isAdmin } = useAuth()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('viewer')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await runWithTimeout(
      supabase.from('ap_user_roles').select('*').order('created_at')
    )
    if (error) {
      setMsg({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    setUsers(data ?? [])
    setLoading(false)
  }

  async function grantRole() {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return
    if (!cleanEmail.endsWith('@saadaa.in')) {
      setMsg({ type: 'error', text: 'Please enter a @saadaa.in email.' })
      return
    }

    setSaving(true)
    setMsg(null)

    const { data: saved, error } = await runWithTimeout(
      supabase
      .from('ap_user_roles')
      .upsert({ email: cleanEmail, role }, { onConflict: 'email' })
      .select('*')
      .single()
    )

    if (error) {
      setMsg({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setUsers(prev => {
      const row = saved ?? { email: cleanEmail, role, created_at: new Date().toISOString() }
      const exists = prev.some(u => u.email === cleanEmail)
      return exists
        ? prev.map(u => u.email === cleanEmail ? { ...u, ...row } : u)
        : [row, ...prev]
    })
    setMsg({ type: 'success', text: `Role "${role}" granted to ${cleanEmail}` })
    setEmail('')
    setSaving(false)
  }

  async function changeRole(id, newRole) {
    const { error } = await runWithTimeout(
      supabase.from('ap_user_roles').update({ role: newRole }).eq('id', id)
    )
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
  }

  async function removeUser(id) {
    if (!confirm('Remove this user\'s access?')) return
    const { error } = await runWithTimeout(
      supabase.from('ap_user_roles').delete().eq('id', id)
    )
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  if (!isAdmin) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>Access restricted to admins.</div>

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Admin</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">Manage who can access and upload data to this dashboard</div>
      </div>

      <Card title="Grant Access" className="mb">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email (@saadaa.in)</div>
            <input
              type="text"
              placeholder="name@saadaa.in"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && grantRole()}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Role</div>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 12px', color: 'var(--text)', fontSize: 11, fontFamily: 'Inter', outline: 'none', cursor: 'pointer' }}
            >
              <option value="viewer">Viewer — read only</option>
              <option value="uploader">Uploader — can upload CSVs</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={grantRole} disabled={saving || !email.trim()}>
            {saving ? 'Saving...' : 'Grant Access'}
          </button>
        </div>
        {msg && (
          <div style={{ marginTop: 12, fontSize: 11, color: msg.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
            {msg.text}
          </div>
        )}
      </Card>

      <Card title="Current Users">
        {loading
          ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
          : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Email</th><th>Role</th><th>Since</th><th>Change Role</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      <Tag color={u.role === 'admin' ? 'red' : u.role === 'uploader' ? 'amber' : 'blue'}>{u.role}</Tag>
                    </td>
                    <td className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', fontSize: 10, outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="viewer">viewer</option>
                        <option value="uploader">uploader</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <button onClick={() => removeUser(u.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
