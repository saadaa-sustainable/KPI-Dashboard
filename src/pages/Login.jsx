import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [mode,     setMode]     = useState('login') // login | signup
  const [error,    setError]    = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/')
  }, [user, loading])

  async function handleSubmit() {
    if (!email || !password) return
    setSubmitting(true)
    setError(null)
    const fn = mode === 'login' ? signInWithEmail : signUpWithEmail
    const { error: err } = await fn(email, password)
    if (err) { setError(err.message); setSubmitting(false) }
    else if (mode === 'signup') {
      setError('Account created! You can now sign in.')
      setMode('login')
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">SAADAA · Finance</div>
        <div className="login-title">AP KPI Dashboard</div>
        <div className="login-sub">
          {mode === 'login' ? 'Sign in to access accounts payable analytics.' : 'Create your account.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '10px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '10px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter' }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 11, marginBottom: 12, color: error.includes('created') ? 'var(--green)' : 'var(--red)' }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '11px', fontSize: 13 }}
          onClick={handleSubmit}
          disabled={submitting || !email || !password}
        >
          {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          {mode === 'login'
            ? <span>No account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setMode('signup'); setError(null) }}>Create one</span></span>
            : <span>Have an account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(null) }}>Sign in</span></span>
          }
        </div>
      </div>
    </div>
  )
}
