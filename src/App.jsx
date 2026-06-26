import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { RequireAuth, RequireUploader, RequireAdmin } from './components/Guards'
import AppShell    from './components/AppShell'
import Login       from './pages/Login'
import Overview    from './pages/Overview'
import ErrorRate   from './pages/ErrorRate'
import DelayedEntry from './pages/DelayedEntry'
import CostSavings from './pages/CostSavings'
import InvoiceLog  from './pages/InvoiceLog'
import Upload      from './pages/Upload'
import Admin       from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={<RequireAuth><AppShell /></RequireAuth>}
          >
            <Route index              element={<Overview />} />
            <Route path="error-rate"  element={<ErrorRate />} />
            <Route path="delayed-entry" element={<DelayedEntry />} />
            <Route path="cost-savings"  element={<CostSavings />} />
            <Route path="invoices"      element={<InvoiceLog />} />
            <Route path="upload"        element={<RequireUploader><Upload /></RequireUploader>} />
            <Route path="admin"         element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
