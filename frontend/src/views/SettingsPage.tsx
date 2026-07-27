import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Bell,
  Check,
  ExternalLink,
  Shield,
  Loader2,
  Copy,
  Clock,
  LogOut,
  User as UserIcon,
  Sparkles
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [ticktickConnected, setTicktickConnected] = useState(false)
  const [ticktickLoading, setTicktickLoading] = useState(true)
  const [ticktickProjects, setTicktickProjects] = useState<any[]>([])
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState('')

  useEffect(() => {
    if (searchParams.get('ticktick') === 'connected') {
      setNoticeMessage('TickTick connected successfully!')
      setTimeout(() => setNoticeMessage(''), 4000)
    }
  }, [searchParams])

  // Check TickTick status
  const loadTicktickStatus = async () => {
    try {
      const res = await api.get<{ connected: boolean; defaultProjectId?: string }>('/integrations/ticktick/status')
      setTicktickConnected(res.connected)
      if (res.connected) {
        try {
          const projs = await api.get<any[]>('/integrations/ticktick/projects')
          setTicktickProjects(projs)
        } catch (err) {
          console.warn('Failed to load TickTick projects:', err)
        }
      }
    } catch (err) {
      console.warn('Failed to load TickTick status:', err)
    } finally {
      setTicktickLoading(false)
    }
  }

  // Check Push status
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && ('PushManager' in window || 'Notification' in window)
    setPushSupported(isSupported)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        if (reg.pushManager) {
          reg.pushManager.getSubscription().then((sub) => {
            setPushSubscribed(Boolean(sub))
          })
        }
      }).catch((err) => {
        console.warn('Service Worker registration check:', err)
      })
    }
    loadTicktickStatus()
  }, [])

  const handleConnectTickTick = async () => {
    try {
      const res = await api.get<{ url: string }>('/integrations/ticktick/auth')
      if (res.url) {
        window.location.href = res.url
      }
    } catch (err) {
      alert('Failed to initiate TickTick auth. Make sure TICKTICK_CLIENT_ID is configured.')
    }
  }

  const handleDisconnectTickTick = async () => {
    if (!confirm('Disconnect TickTick account?')) return
    setTicktickLoading(true)
    try {
      await api.delete('/integrations/ticktick')
      setTicktickConnected(false)
      setTicktickProjects([])
    } catch (err) {
      console.error(err)
    } finally {
      setTicktickLoading(false)
    }
  }

  const handleSubscribePush = async () => {
    if (!pushSupported) return
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notification permission denied by browser')
        setPushLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidRes = await api.get<{ publicKey: string }>('/push/vapid-key')
      if (!vapidRes.publicKey) {
        alert('VAPID public key not set on backend environment')
        setPushLoading(false)
        return
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (vapidRes.publicKey.length % 4)) % 4)
      const base64 = (vapidRes.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      })

      const subObj = sub.toJSON()
      await api.post('/push/subscribe', {
        endpoint: subObj.endpoint,
        keys: subObj.keys,
        deviceLabel: navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'
      })

      setPushSubscribed(true)
      setNoticeMessage('Push notifications enabled for this device!')
      setTimeout(() => setNoticeMessage(''), 4000)
    } catch (err: any) {
      console.error('Push registration error:', err)
      alert('Push setup failed: ' + err.message)
    } finally {
      setPushLoading(false)
    }
  }

  const handleUnsubscribePush = async () => {
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await api.delete('/push/unsubscribe', { endpoint: sub.endpoint })
      }
      setPushSubscribed(false)
    } catch (err) {
      console.error(err)
    } finally {
      setPushLoading(false)
    }
  }

  const handleTestPush = async () => {
    setPushLoading(true)
    try {
      const res = await api.post<{ success: boolean; sent: number }>('/push/send-test', {})
      setNoticeMessage(`Test push sent successfully to ${res.sent} device(s)!`)
      setTimeout(() => setNoticeMessage(''), 4000)
    } catch (err: any) {
      alert('Failed to send test push: ' + (err.message || 'Unknown error'))
    } finally {
      setPushLoading(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(label)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const appOrigin = window.location.origin

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto pb-24 min-h-screen relative overflow-x-hidden font-mono text-slate-200">
      {/* Cyber Background backplates */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-20" />

      {/* Header */}
      <header className="cyber-card px-5 py-4 rounded flex items-center justify-between shadow-2xl relative z-10 border border-cyber-cyan/35 bg-black/90">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-yellow" />

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="cyber-btn-secondary p-2 rounded text-cyber-cyan hover:text-white transition-colors"
            title="Back to Bookmarks"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <MarkbelLogo size={32} />
          <div>
            <h1 className="text-lg font-black tracking-widest text-white uppercase">
              System Settings & Integrations
            </h1>
            <p className="text-[9px] text-cyber-cyan font-bold tracking-widest uppercase">Configuration Matrix</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs cyber-btn-danger px-3 py-1.5 rounded"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      {noticeMessage && (
        <div className="cyber-card p-4 rounded border-2 border-cyber-green bg-black/90 text-cyber-green text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(57,255,20,0.2)] animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* User Profile Card */}
      <section className="cyber-card p-6 rounded border border-cyber-cyan/25 bg-black/85 relative space-y-4">
        <div className="flex items-center justify-between border-b border-cyber-cyan/15 pb-3">
          <div className="flex items-center gap-2 text-cyber-cyan text-xs font-bold uppercase tracking-wider">
            <UserIcon className="w-4 h-4" />
            <span>User Account Identity</span>
          </div>
          <span className="text-[10px] text-cyber-yellow bg-black border border-cyber-yellow/30 px-2 py-0.5 font-bold uppercase">
            Active Session
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 text-[10px] block uppercase font-bold">User Name</span>
            <span className="text-white font-bold text-sm">{user?.name}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block uppercase font-bold">Email Address</span>
            <span className="text-white font-bold text-sm">{user?.email}</span>
          </div>
        </div>
      </section>

      {/* TickTick Integration Card */}
      <section className="cyber-card p-6 rounded border border-cyber-cyan/35 bg-black/90 relative space-y-5 shadow-[0_0_20px_rgba(0,240,255,0.08)]">
        <div className="flex items-center justify-between border-b border-cyber-cyan/15 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#617bfb]/20 border border-[#617bfb] text-[#617bfb] flex items-center justify-center font-black rounded">
              ✓
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">TickTick Integration</h3>
              <p className="text-[10px] text-slate-400 font-sans">Push bookmarks directly to your TickTick tasks & reminders list</p>
            </div>
          </div>

          <div>
            {ticktickLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-cyber-cyan" />
            ) : ticktickConnected ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyber-green bg-cyber-green/10 border border-cyber-green/40 px-2.5 py-1 rounded uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded uppercase">
                <XCircle className="w-3.5 h-3.5" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
            When connected, each bookmark card features a <strong>Push to TickTick</strong> button. Bookmarks push to a dedicated <strong>"Markbel"</strong> project by default, or any TickTick project you select.
          </p>

          {ticktickConnected && ticktickProjects.length > 0 && (
            <div className="bg-black/60 border border-cyber-cyan/20 p-4 rounded space-y-2">
              <span className="text-[10px] text-cyber-cyan font-bold uppercase tracking-wider block">Connected TickTick Projects ({ticktickProjects.length})</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {ticktickProjects.map((p) => (
                  <span key={p.id} className="text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded text-slate-300 font-medium">
                    📁 {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            {ticktickConnected ? (
              <button
                onClick={handleDisconnectTickTick}
                className="cyber-btn-danger px-4 py-2 rounded text-xs font-bold uppercase cursor-pointer"
              >
                Disconnect TickTick
              </button>
            ) : (
              <button
                onClick={handleConnectTickTick}
                className="cyber-btn-primary px-5 py-2.5 rounded text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.2)]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Connect TickTick Account</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Web Push Notifications Card */}
      <section className="cyber-card p-6 rounded border border-cyber-pink/35 bg-black/90 relative space-y-5 shadow-[0_0_20px_rgba(255,0,127,0.08)]">
        <div className="flex items-center justify-between border-b border-cyber-pink/15 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-cyber-pink/20 border border-cyber-pink text-cyber-pink flex items-center justify-center font-black rounded">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Cross-Device Web Push</h3>
              <p className="text-[10px] text-slate-400 font-sans">Receive daily digests and due reminders on browser, mobile PWA, or desktop</p>
            </div>
          </div>

          <div>
            {pushSubscribed ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyber-green bg-cyber-green/10 border border-cyber-green/40 px-2.5 py-1 rounded uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Active Device</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyber-yellow bg-cyber-yellow/10 border border-cyber-yellow/40 px-2.5 py-1 rounded uppercase">
                <Clock className="w-3.5 h-3.5" />
                <span>Inactive</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
            Enable browser Service Worker push notifications on this device to receive scheduled digest alerts and due bookmark reminders.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            {pushSubscribed ? (
              <>
                <button
                  onClick={handleUnsubscribePush}
                  disabled={pushLoading}
                  className="cyber-btn-secondary px-4 py-2 rounded text-xs font-bold uppercase cursor-pointer"
                >
                  Disable Push On This Device
                </button>
                <button
                  onClick={handleTestPush}
                  disabled={pushLoading}
                  className="cyber-btn-primary px-4 py-2 rounded text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(57,255,20,0.2)]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Test Push Now</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleSubscribePush}
                disabled={pushLoading || !pushSupported}
                className="cyber-btn-primary px-5 py-2.5 rounded text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(255,0,127,0.2)]"
              >
                {pushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                <span>{pushSupported ? 'Enable Push Notifications' : 'Push Not Supported'}</span>
              </button>
            )}
          </div>

          {/* cron-job.org Setup Guide */}
          <div className="border border-cyber-cyan/20 bg-black/60 p-4 rounded space-y-3 pt-3">
            <div className="flex items-center gap-2 text-cyber-cyan text-xs font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>cron-job.org Trigger Endpoints for All Devices</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              To trigger automated notifications across all your devices, set up free cron jobs at <a href="https://console.cron-job.org/jobs" target="_blank" rel="noreferrer" className="text-cyber-cyan underline font-mono">console.cron-job.org</a>:
            </p>

            <div className="space-y-2 text-xs">
              <div className="bg-black p-2.5 rounded border border-white/10 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[9px] text-cyber-yellow block font-bold uppercase">1. Daily Digest (Set schedule: Daily 9:00 AM)</span>
                  <code className="text-[10px] text-slate-300 truncate block">{appOrigin}/api/notifications/digest</code>
                </div>
                <button
                  onClick={() => handleCopy(`${appOrigin}/api/notifications/digest`, 'digest')}
                  className="cyber-btn-secondary p-1.5 rounded shrink-0"
                  title="Copy Digest URL"
                >
                  {copiedUrl === 'digest' ? <Check className="w-3.5 h-3.5 text-cyber-green" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-black p-2.5 rounded border border-white/10 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[9px] text-cyber-yellow block font-bold uppercase">2. Due Reminder Check (Set schedule: Every 30 mins)</span>
                  <code className="text-[10px] text-slate-300 truncate block">{appOrigin}/api/notifications/due-check</code>
                </div>
                <button
                  onClick={() => handleCopy(`${appOrigin}/api/notifications/due-check`, 'due')}
                  className="cyber-btn-secondary p-1.5 rounded shrink-0"
                  title="Copy Due Check URL"
                >
                  {copiedUrl === 'due' ? <Check className="w-3.5 h-3.5 text-cyber-green" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-sans">
              * In cron-job.org, add custom header: <code className="text-cyber-pink">Authorization: Bearer YOUR_CRON_SECRET</code> or append <code className="text-cyber-pink">?secret=YOUR_CRON_SECRET</code> to the URL.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
