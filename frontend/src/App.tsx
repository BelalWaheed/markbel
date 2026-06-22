import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth.js'
import LoginPage from './views/LoginPage.js'
import BookmarksPage from './views/BookmarksPage.js'
import ShareTargetPage from './views/ShareTargetPage.js'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] gap-3 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan" />
        <span className="text-[10px] font-bold tracking-widest text-cyber-cyan/50 uppercase">TUNNELING_MARKBEL_SYS_RESOURCES...</span>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
