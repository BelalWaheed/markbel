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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Cyberpunk Scanlines & Matrix Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-20" />

      {/* Cyber Ambient Glowing Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] -right-20 w-[500px] h-[500px] cyber-glow-cyan rounded-full" />
        <div className="absolute bottom-[10%] -left-20 w-[450px] h-[450px] cyber-glow-pink rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
          <MarkbelLogo size={56} className="shadow-[0_0_20px_rgba(0,240,255,0.3)]" />
          <h1 className="text-3xl font-black tracking-widest text-white mt-1.5 uppercase font-mono">
            Markbel
          </h1>
          <p className="text-[10px] text-cyber-cyan tracking-wider font-semibold uppercase bg-cyber-cyan/10 border border-cyber-cyan/30 px-3 py-1 mt-1 shadow-[0_0_8px_rgba(0,240,255,0.1)]">
            Bookmarks Vault
          </p>
        </div>

        {/* Cyber card */}
        <div className="cyber-card p-8 relative overflow-hidden border border-cyber-cyan/35 bg-black/85">
          {/* Neon top strip */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-yellow" />

          <div className="text-center mb-6 mt-1">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
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
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-cyan/60" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full cyber-input rounded px-4 py-3 pl-11 text-xs"
                    required={isSignup}
                  />
                </div>
              </motion.div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-cyan/60" />
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full cyber-input rounded px-4 py-3 pl-11 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-cyan/60" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full cyber-input rounded px-4 py-3 pl-11 text-xs"
                  required
                  minLength={4}
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-cyber-pink bg-cyber-pink/10 border border-cyber-pink/30 rounded p-3 font-semibold text-center uppercase"
              >
                Error: {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 cyber-btn-primary py-3 px-4 rounded active:scale-[0.98] mt-6"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-xs">{isSignup ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
            >
              {isSignup ? (
                <>Already have an account? <span className="text-cyber-cyan group-hover:text-cyber-pink transition-colors font-bold ml-1">Sign In</span></>
              ) : (
                <>Don't have an account? <span className="text-cyber-cyan group-hover:text-cyber-pink transition-colors font-bold ml-1">Sign Up</span></>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-cyber-cyan/40 mt-8 tracking-widest font-mono uppercase">
          An understated link manager ⚡
        </p>
      </motion.div>
    </div>
  )
}
