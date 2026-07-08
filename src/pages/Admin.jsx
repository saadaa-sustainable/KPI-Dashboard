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
    { name: 'Grant role', formula: 'upsert role by email; attach user_id when auth.users contains that email' },
  ],
  notes: [
    'Client route guards are intentionally permissive; Supabase RLS is the real permission boundary.',
    'Removing a user deletes the dashboard role row, not the Supabase Auth user.',
  ],
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
    const { data } = await supabase.from('ap_user_roles').select('*').order('created_at')
    setUsers(data ?? [])
    setLoading(false)
  }

  async function grantRole() {
    if (!email.trim()) return
    setSaving(true)
    setMsg(null)

    const { data: existing } = await supabase
      .from('ap_user_roles')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle()

    let error
    if (existing) {
      ;({ error } = await supabase.from('ap_user_roles').update({ role }).eq('id', existing.id))
    } else {
      const { data: authUsers } = await supabase.rpc('get_user_id_by_email', { email_input: email.trim() }).catch(() => ({ data: null }))
      ;({ error } = await supabase.from('ap_user_roles').insert({
        email: email.trim(), role, user_id: authUsers?.[0]?.id ?? null,
      }))
    }

    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: `Role "${role}" granted to ${email}` })
    setEmail('')
    setSaving(false)
    fetchUsers()
  }

  async function changeRole(id, newRole) {
    await supabase.from('ap_user_roles').update({ role: newRole }).eq('id', id)
    fetchUsers()
  }

  async function removeUser(id) {
    if (!confirm('Remove this user\'s access?')) return
    await supabase.from('ap_user_roles').delete().eq('id', id)
    fetchUsers()
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
