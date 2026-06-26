import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from './UI'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

// All authenticated users get full access now
export function RequireUploader({ children }) { return children }
export function RequireAdmin({ children })    { return children }
