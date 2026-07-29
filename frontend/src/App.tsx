import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth.js'
import { ToastProvider } from './components/Toast.js'
import LoginPage from './views/LoginPage.js'
import BookmarksPage from './views/BookmarksPage.js'
import ShareTargetPage from './views/ShareTargetPage.js'
import SettingsPage from './views/SettingsPage.js'
import ArchivePage from './views/ArchivePage.js'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-main)] gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">Loading Markbel...</span>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <BookmarksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share-target"
              element={
                <ProtectedRoute>
                  <ShareTargetPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/archive"
              element={
                <ProtectedRoute>
                  <ArchivePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}
