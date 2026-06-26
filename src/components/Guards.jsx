import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from './UI'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

export function RequireUploader({ children }) {
  const { isUploader, loading } = useAuth()
  if (loading)     return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>
  if (!isUploader) return <Navigate to="/" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading)   return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>
  if (!isAdmin)  return <Navigate to="/" replace />
  return children
}
