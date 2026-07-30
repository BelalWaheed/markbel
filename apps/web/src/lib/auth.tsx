import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api.js'
import { syncManager } from '../db/SyncManager.js'

interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: string
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const sendTokenToNative = (t: string | null) => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'TOKEN_SYNC', token: t })
      );
    }
  }


  useEffect(() => {
    async function bootstrap() {
      try {
        const profile = await api.get<UserProfile>('/users/me')
        setUser(profile)
        // We no longer have direct access to the token, so we can just pass 'cookie'
        // or a dummy value. The actual token is handled by the browser cookie.
        setToken('cookie')
        sendTokenToNative('cookie')
        await syncManager.registerDevice('web', '1.0.0')
        syncManager.startPeriodicSync()
      } catch (err) {
        console.log('[Auth] Not logged in or session expired')
        localStorage.removeItem('markbel_token') // clean up old tokens
        setToken(null)
        setUser(null)
        sendTokenToNative(null)
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/login', { email, password })
      localStorage.removeItem('markbel_token') // Ensure old local tokens are gone
      setToken('cookie')
      setUser(data.user)
      sendTokenToNative('cookie')
      await syncManager.registerDevice('web', '1.0.0')
      syncManager.startPeriodicSync()
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/signup', { name, email, password })
      localStorage.removeItem('markbel_token') // Ensure old local tokens are gone
      setToken('cookie')
      setUser(data.user)
      sendTokenToNative('cookie')
      await syncManager.registerDevice('web', '1.0.0')
      syncManager.startPeriodicSync()
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.post('/users/logout', {})
    } catch (e) {
      console.warn('Logout API failed', e)
    }
    localStorage.removeItem('markbel_token')
    setToken(null)
    setUser(null)
    sendTokenToNative(null)
    syncManager.stop()
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
