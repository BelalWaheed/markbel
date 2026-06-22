import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api.js'

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

  useEffect(() => {
    async function bootstrap() {
      const storedToken = localStorage.getItem('markbel_token')
      if (storedToken) {
        setToken(storedToken)
        try {
          const profile = await api.get<UserProfile>('/users/me')
          setUser(profile)
        } catch (err) {
          console.error('[Auth] Token validation failed, logging out:', err)
          localStorage.removeItem('markbel_token')
          setToken(null)
          setUser(null)
        }
      }
      setLoading(false)
    }
    bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/login', { email, password })
      localStorage.setItem('markbel_token', data.token)
      setToken(data.token)
      setUser(data.user)
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/signup', { name, email, password })
      localStorage.setItem('markbel_token', data.token)
      setToken(data.token)
      setUser(data.user)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('markbel_token')
    setToken(null)
    setUser(null)
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
