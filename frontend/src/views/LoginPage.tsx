import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth.js'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (isSignup) {
        await signup(name, email, password)
      } else {
        await login(email, password)
      }
      navigate(redirectUrl, { replace: true })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setIsSignup(!isSignup)
    setError('')
    setName('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-default)] p-4 relative overflow-hidden text-[var(--color-text-primary)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
          <MarkbelLogo size={56} className="text-[var(--color-accent)] drop-shadow-sm" />
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-1.5 uppercase">
            Markbel
          </h1>
          <p className="text-[10px] text-[var(--color-text-muted)] tracking-wide font-semibold uppercase bg-[var(--color-bg-element)] border border-[var(--color-border-default)] px-3 py-1 mt-1 rounded-md">
            Bookmarks Vault
          </p>
        </div>

        {/* Studio card */}
        <div className="studio-card p-8">
          <div className="text-center mb-6 mt-1">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1.5 font-medium">
              {isSignup
                ? 'Create a unified links vault'
                : 'Sign in to access your saved links'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full studio-input px-4 py-3 pl-11 text-sm"
                    required={isSignup}
                  />
                </div>
              </motion.div>
            )}

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full studio-input px-4 py-3 pl-11 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full studio-input px-4 py-3 pl-11 text-sm"
                  required
                  minLength={4}
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[var(--color-status-error)] bg-red-50 border border-red-200 rounded-md p-3 font-semibold text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 btn-primary py-3 px-4 active:scale-[0.98] mt-6 font-bold"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-sm">{isSignup ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer group font-medium"
            >
              {isSignup ? (
                <>Already have an account? <span className="text-[var(--color-accent)] group-hover:underline transition-colors font-bold ml-1">Sign In</span></>
              ) : (
                <>Don't have an account? <span className="text-[var(--color-accent)] group-hover:underline transition-colors font-bold ml-1">Sign Up</span></>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-8 tracking-wide">
          An understated link manager ⚡
        </p>
      </motion.div>
    </div>
  )
}
