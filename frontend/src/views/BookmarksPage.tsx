import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import { 
  Folder, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  ExternalLink, 
  Copy, 
  Check, 
  ArrowLeft, 
  Link as LinkIcon, 
  FolderOpen, 
  PlusCircle,
  X,
  LogOut,
  User as UserIcon,
  Loader2,
  Sparkles,
  Pin,
  BookmarkCheck,
  Archive,
  Settings,
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bell
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function BookmarksPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, read: 0, unread: 0, savedThisWeek: 0, pinnedCount: 0, archivedCount: 0 })

  // Filter and View states
  const [searchParams, setSearchParams] = useSearchParams()
  const activeGroup = searchParams.get('group')
  const setActiveGroup = (groupName: string | null) => {
    const newParams = new URLSearchParams(searchParams)
    if (groupName) {
      newParams.set('group', groupName)
    } else {
      newParams.delete('group')
    }
    setSearchParams(newParams)
  }
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read' | 'due'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Dialog/Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBookmark, setSelectedBookmark] = useState<any>(null)

  // Form states
  const [formUrl, setFormUrl] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formGroup, setFormGroup] = useState('Read Later')
  const [formImage, setFormImage] = useState('')
  const [formRemindAt, setFormRemindAt] = useState('')
  const [newGroupInput, setNewGroupInput] = useState('')
  const [isScrapingMeta, setIsScrapingMeta] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Custom themed delete confirmation states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookmarkToDelete, setBookmarkToDelete] = useState<any>(null)

  // Archive Modal states
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [bookmarkToArchive, setBookmarkToArchive] = useState<any>(null)
  const [archiveGroupInput, setArchiveGroupInput] = useState('archive-general')

  // TickTick Push Modal states
  const [showTickTickModal, setShowTickTickModal] = useState(false)
  const [bookmarkToPush, setBookmarkToPush] = useState<any>(null)
  const [ticktickProjects, setTicktickProjects] = useState<any[]>([])
  const [selectedTicktickProject, setSelectedTicktickProject] = useState('')
  const [ticktickDueDate, setTicktickDueDate] = useState('')
  const [isPushingTicktick, setIsPushingTicktick] = useState(false)
  const [pushedSuccessId, setPushedSuccessId] = useState<string | null>(null)
  const [ticktickConnected, setTicktickConnected] = useState(false)

  // Resurface state
  const [resurfaceBookmarks, setResurfaceBookmarks] = useState<any[]>([])
  const [showResurface, setShowResurface] = useState(true)

  // Quick Push state
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(Boolean(sub))
        })
      })
    }
  }, [])

  const handleQuickEnablePush = async () => {
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notification permission denied by browser')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidRes = await api.get<{ publicKey: string }>('/push/vapid-key')
      if (!vapidRes.publicKey) {
        alert('VAPID public key not set on backend')
        return
      }

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
      alert('Push notifications enabled for this device!')
    } catch (err: any) {
      console.error(err)
      alert('Push setup failed: ' + err.message)
    } finally {
      setPushLoading(false)
    }
  }

  // Edit Group states
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [formGroupName, setFormGroupName] = useState('')
  const [formGroupColor, setFormGroupColor] = useState('cyan')
  const [isSavingGroup, setIsSavingGroup] = useState(false)

  // Customizable group colors mapping state
  const [groupColors, setGroupColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('markbel_group_colors')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  
  const [selectedColor, setSelectedColor] = useState('cyan')

  const defaultGroupColors: Record<string, string> = {
    'Read Later': 'cyan',
    'Inspiration': 'pink',
    'Design': 'pink',
    'Development': 'green',
    'Resources': 'green',
    'Unsorted': 'yellow'
  }

  const updateGroupColor = (groupName: string, color: string) => {
    const updated = { ...groupColors, [groupName]: color }
    setGroupColors(updated)
    localStorage.setItem('markbel_group_colors', JSON.stringify(updated))
  }

  const renameGroupColor = (oldName: string, newName: string, color: string) => {
    const updated = { ...groupColors }
    delete updated[oldName]
    updated[newName] = color
    setGroupColors(updated)
    localStorage.setItem('markbel_group_colors', JSON.stringify(updated))
  }

  // Fetch bookmarks, stats, and resurface picks
  const loadStats = async () => {
    try {
      const data = await api.get<any>('/bookmarks/stats')
      setStats(data)
    } catch (err) {
      console.warn('Failed to load stats:', err)
    }
  }

  const loadResurface = async () => {
    try {
      const data = await api.get<any[]>('/bookmarks/random?count=3')
      setResurfaceBookmarks(data)
    } catch (err) {
      console.warn('Failed to load resurface picks:', err)
    }
  }

  const checkTicktickStatus = async () => {
    try {
      const res = await api.get<{ connected: boolean }>('/integrations/ticktick/status')
      setTicktickConnected(res.connected)
    } catch (err) {
      console.warn('Failed to check TickTick status:', err)
    }
  }

  const loadBookmarks = async () => {
    try {
      const data = await api.get<any[]>('/bookmarks')
      setBookmarks(data)
      loadStats()
      loadResurface()
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookmarks()
    checkTicktickStatus()
  }, [])

  // Real-time updates via Server-Sent Events (SSE) with reconnect logic
  useEffect(() => {
    const storedToken = localStorage.getItem('markbel_token')
    if (!storedToken || !user) return

    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 1000

    const connectSSE = () => {
      const sseUrl = `/api/bookmarks/events?token=${encodeURIComponent(storedToken)}`
      eventSource = new EventSource(sseUrl)

      eventSource.onopen = () => {
        retryDelay = 1000
      }

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (['bookmark_created', 'bookmark_updated', 'bookmark_deleted'].includes(payload.type)) {
            loadBookmarks()
          }
        } catch (err) {
          console.error('Failed to parse real-time update:', err)
        }
      }

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close()
        }
        reconnectTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000)
          connectSSE()
        }, retryDelay)
      }
    }

    connectSSE()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (eventSource) eventSource.close()
    }
  }, [user])

  // Extract unique groups
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    bookmarks.forEach((b) => {
      const g = b.group || 'Unsorted'
      map.set(g, (map.get(g) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [bookmarks])

  // Filtered bookmarks based on active group + search query + status filter
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks

    // Group filter
    if (activeGroup && !searchQuery.trim()) {
      result = result.filter((b) => (b.group || 'Unsorted') === activeGroup)
    }

    // Status filter
    if (filterStatus === 'unread') {
      result = result.filter((b) => !b.isRead)
    } else if (filterStatus === 'read') {
      result = result.filter((b) => b.isRead)
    } else if (filterStatus === 'due') {
      const now = new Date().toISOString()
      result = result.filter((b) => !b.isRead && b.remindAt && b.remindAt <= now)
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          (b.group || '').toLowerCase().includes(q)
      )
    }

    // Sort: Pinned first, then newest created
    return [...result].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [bookmarks, activeGroup, filterStatus, searchQuery])

  // Due bookmarks count for top alert bar
  const dueBookmarksList = useMemo(() => {
    const now = new Date().toISOString()
    return bookmarks.filter((b) => !b.isRead && b.remindAt && b.remindAt <= now)
  }, [bookmarks])

  // Handle URL change to auto-fetch meta
  const handleUrlBlur = async () => {
    if (!formUrl.trim() || formTitle.trim()) return
    setIsScrapingMeta(true)
    try {
      const meta = await api.get<{ title: string; description: string; image: string }>(
        `/bookmarks/meta?url=${encodeURIComponent(formUrl.trim())}`
      )
      if (meta) {
        if (meta.title && !formTitle) setFormTitle(meta.title)
        if (meta.description && !formDescription) setFormDescription(meta.description)
        if (meta.image && !formImage) setFormImage(meta.image)
      }
    } catch (e) {
      console.warn('Scraper failed:', e)
    } finally {
      setIsScrapingMeta(false)
    }
  }

  // Toggle Read Status
  const handleToggleRead = async (b: any) => {
    try {
      const updated = await api.patch<any>(`/bookmarks/read?id=${b.id}`, { isRead: !b.isRead })
      setBookmarks(bookmarks.map((item) => (item.id === b.id ? updated : item)))
      loadStats()
    } catch (err) {
      console.error(err)
    }
  }

  // Toggle Pin Status
  const handleTogglePin = async (b: any) => {
    try {
      const updated = await api.patch<any>(`/bookmarks/pin?id=${b.id}`, { isPinned: !b.isPinned })
      setBookmarks(bookmarks.map((item) => (item.id === b.id ? updated : item)))
      loadStats()
    } catch (err) {
      console.error(err)
    }
  }

  // Add Bookmark Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formUrl.trim()) return
    const finalGroup = newGroupInput.trim() || formGroup
    setIsSaving(true)

    try {
      const newB = await api.post<any>('/bookmarks', {
        title: formTitle.trim() || formUrl.trim(),
        url: formUrl.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        group: finalGroup,
        remindAt: formRemindAt || ''
      })

      updateGroupColor(finalGroup, selectedColor)
      setBookmarks([newB, ...bookmarks])
      resetForm()
      setShowAddModal(false)
      loadStats()

      setTimeout(() => loadBookmarks(), 3000)
      setTimeout(() => loadBookmarks(), 6000)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Edit Bookmark Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBookmark) return
    setIsSaving(true)
    const finalGroup = newGroupInput.trim() || formGroup

    try {
      const updatedB = await api.put<any>(`/bookmarks?id=${selectedBookmark.id}`, {
        title: formTitle.trim(),
        url: formUrl.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        group: finalGroup,
        remindAt: formRemindAt || ''
      })

      updateGroupColor(finalGroup, selectedColor)
      setBookmarks(bookmarks.map((b) => (b.id === selectedBookmark.id ? updatedB : b)))
      resetForm()
      setShowEditModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Bookmark Handlers
  const handleDeleteClick = (b: any) => {
    setBookmarkToDelete(b)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!bookmarkToDelete) return
    try {
      await api.delete(`/bookmarks?id=${bookmarkToDelete.id}`)
      setBookmarks(bookmarks.filter((b) => b.id !== bookmarkToDelete.id))
      if (selectedBookmark?.id === bookmarkToDelete.id) {
        setShowEditModal(false)
        resetForm()
      }
      setShowDeleteModal(false)
      setBookmarkToDelete(null)
      loadStats()
    } catch (err) {
      console.error(err)
    }
  }

  // Archive Handlers
  const openArchive = (b: any) => {
    setBookmarkToArchive(b)
    setArchiveGroupInput('archive-' + (b.group ? b.group.toLowerCase().replace(/\s+/g, '-') : 'general'))
    setShowArchiveModal(true)
  }

  const confirmArchive = async () => {
    if (!bookmarkToArchive) return
    try {
      await api.patch(`/bookmarks/archive?id=${bookmarkToArchive.id}`, {
        archiveGroup: archiveGroupInput.trim() || 'archive-general'
      })
      setBookmarks(bookmarks.filter((b) => b.id !== bookmarkToArchive.id))
      setShowArchiveModal(false)
      setBookmarkToArchive(null)
      loadStats()
    } catch (err) {
      console.error(err)
    }
  }

  // TickTick Push Handlers
  const openTickTick = async (b: any) => {
    setBookmarkToPush(b)
    setTicktickDueDate(b.remindAt ? b.remindAt.substring(0, 10) : '')
    setShowTickTickModal(true)
    try {
      const status = await api.get<{ connected: boolean; defaultProjectId?: string }>('/integrations/ticktick/status')
      setTicktickConnected(status.connected)
      if (status.connected) {
        const projs = await api.get<any[]>('/integrations/ticktick/projects')
        setTicktickProjects(projs)
        setSelectedTicktickProject(status.defaultProjectId || projs[0]?.id || '')
      }
    } catch (err) {
      console.warn('Failed to load TickTick projects:', err)
    }
  }

  const confirmPushTickTick = async () => {
    if (!bookmarkToPush) return
    setIsPushingTicktick(true)
    try {
      await api.post('/integrations/ticktick/push', {
        bookmarkId: bookmarkToPush.id,
        projectId: selectedTicktickProject,
        dueDate: ticktickDueDate
      })
      setPushedSuccessId(bookmarkToPush.id)
      setTimeout(() => setPushedSuccessId(null), 3000)
      setShowTickTickModal(false)
      setBookmarkToPush(null)
    } catch (err: any) {
      alert('Failed to push to TickTick: ' + (err.message || 'Unknown error'))
    } finally {
      setIsPushingTicktick(false)
    }
  }

  // Edit Group Handlers
  const openEditGroup = (groupName: string) => {
    setEditingGroupName(groupName)
    setFormGroupName(groupName)
    const color = groupColors[groupName] || defaultGroupColors[groupName] || 'cyan'
    setFormGroupColor(color)
    setShowEditGroupModal(true)
  }

  const handleEditGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formGroupName.trim()) return
    const newName = formGroupName.trim()
    const oldName = editingGroupName
    setIsSavingGroup(true)

    try {
      if (oldName !== newName) {
        await api.put('/bookmarks/group', { oldName, newName })
        setBookmarks(bookmarks.map((b) => (b.group === oldName ? { ...b, group: newName } : b)))
        renameGroupColor(oldName, newName, formGroupColor)
        if (activeGroup === oldName) {
          setActiveGroup(newName)
        }
      } else {
        updateGroupColor(oldName, formGroupColor)
      }
      setShowEditGroupModal(false)
    } catch (err) {
      console.error('Failed to update group:', err)
    } finally {
      setIsSavingGroup(false)
    }
  }

  const resetForm = () => {
    setFormUrl('')
    setFormTitle('')
    setFormDescription('')
    setFormImage('')
    setFormRemindAt('')
    setFormGroup('Read Later')
    setNewGroupInput('')
    setSelectedBookmark(null)
  }

  const openEdit = (b: any) => {
    setSelectedBookmark(b)
    setFormUrl(b.url)
    setFormTitle(b.title)
    setFormDescription(b.description || '')
    setFormImage(b.image || '')
    setFormRemindAt(b.remindAt ? b.remindAt.substring(0, 16) : '')
    setFormGroup(b.group || 'Unsorted')
    const color = groupColors[b.group] || defaultGroupColors[b.group] || 'cyan'
    setSelectedColor(color)
    setShowEditModal(true)
  }

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCardClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr)
      return url.hostname.replace('www.', '')
    } catch {
      return urlStr
    }
  }

  const getGroupColor = (name: string) => {
    const color = groupColors[name] || defaultGroupColors[name]
    if (color === 'cyan') return 'text-cyber-cyan border-cyber-cyan bg-cyber-cyan/5 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
    if (color === 'pink') return 'text-cyber-pink border-cyber-pink bg-cyber-pink/5 shadow-[0_0_8px_rgba(255,0,127,0.15)]'
    if (color === 'green') return 'text-cyber-green border-cyber-green bg-cyber-green/5 shadow-[0_0_8px_rgba(57,255,20,0.15)]'
    if (color === 'yellow') return 'text-cyber-yellow border-cyber-yellow bg-cyber-yellow/5 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
    
    const n = name.toLowerCase()
    if (n.includes('read') || n.includes('later')) return 'text-cyber-cyan border-cyber-cyan bg-cyber-cyan/5 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
    if (n.includes('inspire') || n.includes('design')) return 'text-cyber-pink border-cyber-pink bg-cyber-pink/5 shadow-[0_0_8px_rgba(255,0,127,0.15)]'
    if (n.includes('resource') || n.includes('dev')) return 'text-cyber-green border-cyber-green bg-cyber-green/5 shadow-[0_0_8px_rgba(57,255,20,0.15)]'
    return 'text-cyber-yellow border-cyber-yellow bg-cyber-yellow/5 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 min-h-screen relative overflow-x-hidden">
      {/* Cyber Grid & Scanline Backplates */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-20" />

      {/* Cyber Glowing Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] right-[10%] w-[550px] h-[550px] cyber-glow-cyan rounded-full" />
        <div className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] cyber-glow-pink rounded-full" />
      </div>

      {/* Header Navbar */}
      <header className="cyber-card px-5 py-4 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl relative z-10 border border-cyber-cyan/35 bg-black/90">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-yellow" />

        <div className="flex items-center gap-3">
          <MarkbelLogo size={38} className="shadow-[0_0_10px_rgba(0,240,255,0.15)]" />
          <div>
            <h1 className="text-xl font-black tracking-widest text-white font-mono uppercase">
              Markbel
            </h1>
            <p className="text-[9px] text-cyber-cyan font-mono font-bold tracking-widest uppercase">Bookmarks Vault</p>
          </div>
        </div>

        {/* Live Stats Bar */}
        <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-slate-300 bg-black/80 border border-cyber-cyan/20 px-3 py-1.5 rounded">
          <span className="text-cyber-cyan">{stats.unread} unread</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyber-green">{stats.savedThisWeek} saved this week</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">{stats.total} total</span>
        </div>

        {/* Quick Nav Actions */}
        <div className="flex items-center gap-2 font-mono">
          {!pushSubscribed && (
            <button
              onClick={handleQuickEnablePush}
              disabled={pushLoading}
              className="flex items-center gap-1.5 text-xs cyber-btn-primary px-3 py-1.5 rounded shadow-[0_0_10px_rgba(255,0,127,0.3)] animate-pulse"
              title="Click to enable Web Push Notifications on this device with 1 click"
            >
              {pushLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Enable Push</span>
            </button>
          )}
          <button
            onClick={() => navigate('/archive')}
            className="flex items-center gap-1.5 text-xs cyber-btn-secondary px-3 py-1.5 rounded border border-cyber-yellow/30 text-cyber-yellow hover:text-white"
            title="Cold Storage Archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Archive</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-xs cyber-btn-secondary px-3 py-1.5 rounded border border-cyber-cyan/30 text-cyber-cyan hover:text-white"
            title="Settings & Integrations"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 text-xs cyber-btn-danger px-3 py-1.5 rounded"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Urgent "Due Today" Alert Banner */}
      {dueBookmarksList.length > 0 && (
        <div className="cyber-card p-4 rounded border-2 border-cyber-pink bg-black/90 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(255,0,127,0.2)] font-mono animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyber-pink/20 border border-cyber-pink text-cyber-pink flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Reading Reminders Due Today ({dueBookmarksList.length})
              </h4>
              <p className="text-[10px] text-slate-300 font-sans">
                You set reminders to read these links today!
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterStatus('due')}
            className="cyber-btn-primary px-3.5 py-1.5 rounded text-xs font-bold uppercase shrink-0"
          >
            View Due Reminders →
          </button>
        </div>
      )}

      {/* Resurface Discovery Card (Random Unread Pick) */}
      {showResurface && resurfaceBookmarks.length > 0 && (
        <section className="cyber-card p-4 sm:p-5 rounded border border-cyber-yellow/40 bg-black/90 relative z-10 font-mono space-y-3 shadow-[0_0_15px_rgba(255,230,0,0.1)]">
          <div className="flex items-center justify-between border-b border-cyber-yellow/20 pb-2.5">
            <div className="flex items-center gap-2 text-cyber-yellow text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Resurface // Rediscovery Suggestions</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadResurface}
                className="flex items-center gap-1 text-[10px] text-cyber-yellow hover:text-white border border-cyber-yellow/30 px-2 py-0.5 rounded cursor-pointer"
                title="Shuffle rediscovery suggestions"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Shuffle</span>
              </button>
              <button
                onClick={() => setShowResurface(false)}
                className="text-slate-500 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {resurfaceBookmarks.map((rb) => (
              <div
                key={rb.id}
                onClick={() => handleCardClick(rb.url)}
                className="border border-white/10 hover:border-cyber-yellow bg-black p-3 rounded cursor-pointer group space-y-1 transition-all"
              >
                <span className="text-[8px] font-bold text-cyber-yellow uppercase tracking-widest block">
                  📁 {rb.group}
                </span>
                <h5 className="text-xs font-bold text-white group-hover:text-cyber-yellow line-clamp-1">
                  {rb.title}
                </h5>
                <p className="text-[10px] text-slate-400 truncate font-sans">
                  {rb.url}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Navigation & Controls */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3 font-mono">
          {activeGroup && (
            <button 
              onClick={() => setActiveGroup(null)}
              className="flex items-center cyber-btn-secondary px-3.5 py-2 rounded text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>All Groups</span>
            </button>
          )}
          <h2 className="text-2xl font-black text-white tracking-widest uppercase flex items-center gap-2">
            <span>{activeGroup ? activeGroup : 'Vault Groups'}</span>
            {activeGroup && (
              <button
                onClick={() => openEditGroup(activeGroup)}
                className="p-1 hover:bg-white/10 rounded text-cyber-cyan hover:text-white transition-colors cursor-pointer border border-cyber-cyan/35 bg-black"
                title="Edit Group Title/Color"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
          </h2>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto font-mono">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-black/80 border border-cyber-cyan/25 rounded p-1 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded transition-colors font-bold uppercase ${
                filterStatus === 'all' ? 'bg-cyber-cyan text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('unread')}
              className={`px-3 py-1 rounded transition-colors font-bold uppercase ${
                filterStatus === 'unread' ? 'bg-cyber-cyan text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilterStatus('read')}
              className={`px-3 py-1 rounded transition-colors font-bold uppercase ${
                filterStatus === 'read' ? 'bg-cyber-cyan text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Read
            </button>
            <button
              onClick={() => setFilterStatus('due')}
              className={`px-3 py-1 rounded transition-colors font-bold uppercase ${
                filterStatus === 'due' ? 'bg-cyber-pink text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Due
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2.5 bg-black/80 border border-cyber-cyan/25 rounded px-3.5 py-2 w-full sm:w-64 max-w-sm focus-within:border-cyber-pink focus-within:shadow-[0_0_12px_rgba(255,0,127,0.2)] transition-all">
            <span className="text-[10px] text-cyber-cyan/60 font-bold">[SYS.SEARCH]&gt;</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search links..."
              className="bg-transparent text-xs text-cyber-cyan placeholder-cyber-cyan/30 outline-none w-full font-bold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-cyber-pink hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button 
            onClick={() => { resetForm(); setShowAddModal(true) }}
            className="flex items-center justify-center gap-1.5 cyber-btn-primary text-xs px-4.5 py-2.5 rounded active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bookmark</span>
          </button>
        </div>
      </section>

      {/* Main Grid View */}
      <main className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan" />
            <span className="text-[10px] font-mono tracking-widest text-cyber-cyan/50 uppercase">Loading bookmarks...</span>
          </div>
        ) : searchQuery.trim() || activeGroup || filterStatus !== 'all' ? (
          /* Bookmarks List View within Group, Search, or Status Filter */
          <div>
            {filteredBookmarks.length === 0 ? (
              <div className="text-center py-20 cyber-card rounded border-dashed border-cyber-cyan/20 max-w-md mx-auto bg-black/80 font-mono">
                <FolderOpen className="w-12 h-12 mx-auto text-cyber-cyan/40 mb-3" />
                <h3 className="text-sm font-bold text-white uppercase mb-1">No bookmarks match filter</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4 font-sans">
                  Try changing your status filter tabs or search terms.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {filteredBookmarks.map((b) => (
                  <div 
                    key={b.id} 
                    onClick={() => handleCardClick(b.url)}
                    className={`cyber-card cyber-card-hover rounded overflow-hidden flex flex-col justify-between group border-cyber-cyan/20 bg-black/85 relative cursor-pointer ${
                      b.isRead ? 'opacity-75 hover:opacity-100' : ''
                    }`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-cyan opacity-40 group-hover:bg-cyber-pink group-hover:opacity-100 transition-colors" />

                    <div>
                      {/* Image Thumbnail with Overlay Actions */}
                      <div className="relative aspect-video bg-black border-b border-cyber-cyan/15 overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center text-cyber-cyan/30 bg-cyber-cyan/3 z-0">
                          <LinkIcon className="w-8 h-8 opacity-25" />
                        </div>
                        
                        {b.image && (
                          <img 
                            src={b.image} 
                            alt={b.title} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 backdrop-blur-[2px] z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(b.id, b.url); }}
                            className="w-8 h-8 border border-cyber-cyan/40 bg-black hover:border-cyber-cyan text-cyber-cyan flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                            title="Copy Link URL"
                          >
                            {copiedId === b.id ? <Check className="w-4 h-4 text-cyber-green" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(b); }}
                            className={`w-8 h-8 border bg-black flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                              b.isPinned ? 'border-cyber-yellow text-cyber-yellow' : 'border-white/30 text-white hover:border-cyber-yellow'
                            }`}
                            title={b.isPinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openTickTick(b); }}
                            className="w-8 h-8 border border-[#617bfb]/50 bg-black hover:border-[#617bfb] text-[#617bfb] flex items-center justify-center cursor-pointer transition-all active:scale-95 font-bold"
                            title="Push to TickTick Task"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openArchive(b); }}
                            className="w-8 h-8 border border-cyber-yellow/40 bg-black hover:border-cyber-yellow text-cyber-yellow flex items-center justify-center cursor-pointer transition-all active:scale-95"
                            title="Archive Bookmark"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 z-10 font-mono flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-cyber-cyan bg-black border border-cyber-cyan/30 px-2 py-0.5 shadow-sm">
                            {b.group || 'Unsorted'}
                          </span>

                          {/* Unread dot indicator */}
                          {!b.isRead && (
                            <span className="w-2 h-2 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00f0ff] animate-pulse" title="Unread" />
                          )}

                          {/* Pinned badge */}
                          {b.isPinned && (
                            <span className="text-[9px] font-bold text-cyber-yellow bg-black border border-cyber-yellow/40 px-1.5 py-0.5" title="Pinned">
                              📌
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-3.5 sm:p-5 space-y-1 sm:space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <div className="flex items-center gap-1.5 truncate">
                            <Sparkles className="w-3 h-3 text-cyber-yellow shrink-0" />
                            <span className="text-[8px] sm:text-[9px] font-bold text-cyber-cyan/70 uppercase tracking-widest block truncate">
                              {getDomain(b.url)}
                            </span>
                          </div>

                          {/* Read/Unread Toggle Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleRead(b); }}
                            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border transition-colors cursor-pointer ${
                              b.isRead 
                                ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' 
                                : 'bg-cyber-cyan/10 border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20'
                            }`}
                          >
                            {b.isRead ? 'Read ✓' : 'Mark Read'}
                          </button>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-white leading-snug line-clamp-2 group-hover:text-cyber-cyan transition-colors font-sans">
                          {b.title}
                        </h4>
                        {b.description && (
                          <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed line-clamp-2 sm:line-clamp-3 font-sans font-medium">
                            {b.description}
                          </p>
                        )}

                        {/* Reminder Badge */}
                        {b.remindAt && (
                          <div className="pt-1 flex items-center gap-1 text-[10px] text-cyber-pink font-mono font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Remind: {new Date(b.remindAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer actions */}
                    <div className="px-3.5 pb-3.5 pt-2.5 sm:px-5 sm:pb-5 sm:pt-3 border-t border-cyber-cyan/10 flex items-center justify-between bg-black/40 font-mono relative z-20">
                      <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        Saved {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1.5 sm:gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(b); }}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-955/20 rounded p-1 sm:p-1.5 transition-colors cursor-pointer border border-transparent hover:border-red-900/30"
                          title="Delete Bookmark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                          className="flex items-center gap-1 sm:gap-1.5 border border-cyber-cyan/30 hover:border-cyber-cyan bg-cyber-cyan/5 text-cyber-cyan text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 rounded transition-all cursor-pointer font-bold active:scale-95"
                          title="Edit Bookmark Details"
                        >
                          <span>Edit</span>
                          <Edit className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Folders Dashboard View */
          <div>
            {groups.length === 0 ? (
              <div className="max-w-3xl mx-auto space-y-8 relative z-10 font-mono">
                <div className="cyber-card p-6 sm:p-8 rounded border-2 border-cyber-cyan bg-black/90 relative overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-yellow" />
                  
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-cyber-cyan font-mono text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
                      <span>System Initialization // Onboarding Guide</span>
                    </div>
                    
                    <h3 className="text-lg sm:text-xl font-mono font-black text-white uppercase tracking-wider">
                      Welcome to Markbel Bookmarks Vault
                    </h3>
                    
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans font-medium">
                      Markbel is a high-performance link vault with task integration. Here is how to get started:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2 text-left">
                      <div className="border border-cyber-cyan/20 p-5 rounded bg-cyan-950/5 hover:border-cyber-cyan/50 transition-all space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-cyber-cyan font-bold text-xs sm:text-sm">01 //</span>
                          <h4 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">Quick URL-Only Saves</h4>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-sans font-medium">
                          Paste any URL and click <strong>Create</strong>. Auto-scrapes metadata, OG images, and YouTube titles in the background.
                        </p>
                      </div>

                      <div className="border border-cyber-yellow/20 p-5 rounded bg-yellow-950/5 hover:border-cyber-yellow/50 transition-all space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-cyber-yellow font-bold text-xs sm:text-sm">02 //</span>
                          <h4 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">TickTick Tasks Integration</h4>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-sans font-medium">
                          Connect TickTick in Settings. Turn reading bookmarks into real tasks with due dates and project organization.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-center">
                      <button
                        onClick={() => { resetForm(); setShowAddModal(true) }}
                        className="cyber-btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded text-xs font-bold tracking-widest uppercase flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Bookmark</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {groups.map((group) => {
                  const borderGlow = getGroupColor(group.name)
                  return (
                    <div 
                      key={group.name} 
                      onClick={() => setActiveGroup(group.name)}
                      className={`cyber-card cyber-card-hover p-4 sm:p-6 rounded cursor-pointer flex flex-col justify-between h-32 sm:h-40 border bg-black/85 group ${borderGlow}`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <div className="w-10 h-10 border border-current flex items-center justify-center bg-black/50 text-inherit">
                          <Folder className="w-5 h-5 fill-current" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] sm:text-[9px] font-bold bg-black/85 border border-white/5 px-2 py-0.5 text-slate-300">
                            {group.count} {group.count === 1 ? 'link' : 'links'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditGroup(group.name);
                            }}
                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/10"
                            title="Edit Group"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 font-mono">
                        <h4 className="font-bold text-sm sm:text-base text-white group-hover:text-cyber-cyan transition-colors truncate">
                          {group.name}
                        </h4>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">
                          View Group →
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* Quick create group card */}
                <div 
                  onClick={() => { resetForm(); setShowAddModal(true) }}
                  className="border border-dashed border-cyber-cyan/25 hover:border-cyber-pink hover:bg-cyber-pink/3 transition-all duration-300 rounded h-32 sm:h-40 flex flex-col items-center justify-center text-center p-4 sm:p-6 cursor-pointer group font-mono"
                >
                  <PlusCircle className="w-7 h-7 sm:w-8 sm:h-8 text-cyber-cyan group-hover:text-cyber-pink mb-2 transition-colors duration-300" />
                  <span className="text-xs text-cyber-cyan group-hover:text-cyber-pink font-bold transition-colors duration-300">
                    New Group
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Bookmark Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-lg p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-cyan bg-black font-mono">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyber-cyan to-cyber-pink" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white uppercase">Add Bookmark</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-cyber-pink hover:text-white cursor-pointer bg-white/5 rounded p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">URL</label>
                <input 
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://example.com/resource" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Title</label>
                  {isScrapingMeta && <span className="text-[10px] text-cyber-green font-bold animate-pulse">Fetching info...</span>}
                </div>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Title details" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Description</label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notes, takeaways..." 
                  rows={2}
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm resize-none font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Optional Reading Reminder Date</label>
                <input 
                  type="datetime-local"
                  value={formRemindAt}
                  onChange={(e) => setFormRemindAt(e.target.value)}
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm text-cyber-cyan bg-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group</label>
                  <select
                    value={formGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormGroup(val);
                      const color = groupColors[val] || defaultGroupColors[val] || 'cyan';
                      setSelectedColor(color);
                    }}
                    className="w-full cyber-input rounded px-3 py-2.5 text-sm bg-black text-cyber-cyan"
                  >
                    <option value="Read Later" className="bg-black text-cyber-cyan">Read Later</option>
                    <option value="Inspiration" className="bg-black text-cyber-cyan">Inspiration</option>
                    <option value="Development" className="bg-black text-cyber-cyan">Development</option>
                    <option value="Resources" className="bg-black text-cyber-cyan">Resources</option>
                    <option value="Unsorted" className="bg-black text-cyber-cyan">Unsorted</option>
                    {groups.map(g => (
                      !['Read Later', 'Inspiration', 'Development', 'Resources', 'Unsorted'].includes(g.name) && (
                        <option key={g.name} value={g.name} className="bg-black text-cyber-cyan">{g.name}</option>
                      )
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Or Create Group</label>
                  <input 
                    type="text"
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    placeholder="New Group Name" 
                    className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-cyber-cyan/15">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="cyber-btn-secondary px-4 py-2.5 rounded text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="cyber-btn-primary px-5 py-2.5 rounded text-xs font-bold"
                >
                  {isSaving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bookmark Modal */}
      {showEditModal && selectedBookmark && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-lg p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-pink bg-black font-mono">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyber-pink to-cyber-cyan" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white uppercase">Edit Bookmark</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-cyber-pink hover:text-white cursor-pointer bg-white/5 rounded p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">URL</label>
                <input 
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/..." 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Title</label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Title details" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Description</label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Write description notes..." 
                  rows={2}
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm resize-none font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Reminder Date & Time</label>
                <input 
                  type="datetime-local"
                  value={formRemindAt}
                  onChange={(e) => setFormRemindAt(e.target.value)}
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm text-cyber-cyan bg-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group</label>
                  <select
                    value={formGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormGroup(val);
                      const color = groupColors[val] || defaultGroupColors[val] || 'cyan';
                      setSelectedColor(color);
                    }}
                    className="w-full cyber-input rounded px-3 py-2.5 text-sm bg-black text-cyber-cyan"
                  >
                    {groups.map(g => (
                      <option key={g.name} value={g.name} className="bg-black text-cyber-cyan">{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Or Move to New</label>
                  <input 
                    type="text"
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    placeholder="New Group Name" 
                    className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-cyber-cyan/15">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="cyber-btn-secondary px-4 py-2.5 rounded text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="cyber-btn-primary px-5 py-2.5 rounded text-xs font-bold"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Push to TickTick Modal */}
      {showTickTickModal && bookmarkToPush && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl border-2 border-[#617bfb] bg-black font-mono">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#617bfb]">
                <span className="font-black text-lg">✓</span>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Push to TickTick Task</h3>
              </div>
              <button 
                onClick={() => setShowTickTickModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!ticktickConnected ? (
              <div className="space-y-4 py-2 text-center">
                <p className="text-xs text-slate-300 font-sans">
                  Your TickTick account is not connected yet. Connect your account in Settings to push bookmarks as tasks.
                </p>
                <button
                  onClick={() => { setShowTickTickModal(false); navigate('/settings'); }}
                  className="cyber-btn-primary px-4 py-2 rounded text-xs font-bold uppercase"
                >
                  Open Settings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-black/60 border border-white/10 p-3 rounded text-xs space-y-1">
                  <span className="text-[10px] text-cyber-cyan font-bold block uppercase">Bookmark Title</span>
                  <span className="text-white font-bold block truncate">{bookmarkToPush.title}</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Select TickTick Project</label>
                  <select
                    value={selectedTicktickProject}
                    onChange={(e) => setSelectedTicktickProject(e.target.value)}
                    className="w-full cyber-input rounded px-3 py-2.5 text-sm bg-black text-[#617bfb]"
                  >
                    {ticktickProjects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-black text-[#617bfb]">
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={ticktickDueDate}
                    onChange={(e) => setTicktickDueDate(e.target.value)}
                    className="w-full cyber-input rounded px-3.5 py-2.5 text-sm bg-black text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowTickTickModal(false)}
                    className="cyber-btn-secondary px-4 py-2 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmPushTickTick}
                    disabled={isPushingTicktick}
                    className="cyber-btn-primary px-5 py-2 rounded text-xs font-bold uppercase flex items-center gap-1.5"
                  >
                    {isPushingTicktick ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Push Task</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && bookmarkToArchive && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl border-2 border-cyber-yellow bg-black font-mono">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-cyber-yellow">
                <Archive className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase text-white">Archive Bookmark</h3>
              </div>
              <button 
                onClick={() => setShowArchiveModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 font-sans">
                Move <strong>"{bookmarkToArchive.title}"</strong> to cold storage archive?
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Archive Sub-Group (e.g. archive-dev, archive-fun)</label>
                <input 
                  type="text"
                  value={archiveGroupInput}
                  onChange={(e) => setArchiveGroupInput(e.target.value)}
                  placeholder="archive-dev" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm text-cyber-yellow"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-cyber-yellow/20">
                <button 
                  type="button" 
                  onClick={() => setShowArchiveModal(false)}
                  className="cyber-btn-secondary px-4 py-2 rounded text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmArchive}
                  className="cyber-btn-primary px-5 py-2 rounded text-xs font-bold uppercase"
                >
                  Confirm Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && bookmarkToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl border-2 border-red-500 bg-black">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-red-400 uppercase">Confirm Delete</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 mb-5 font-sans">
              Permanently delete <strong>"{bookmarkToDelete.title}"</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="cyber-btn-secondary px-4 py-2 rounded text-xs">
                Cancel
              </button>
              <button onClick={confirmDelete} className="cyber-btn-danger px-5 py-2 rounded text-xs font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl border-2 border-cyber-cyan bg-black">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase">Edit Group Name</h3>
              <button onClick={() => setShowEditGroupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <input
                type="text"
                value={formGroupName}
                onChange={(e) => setFormGroupName(e.target.value)}
                className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                required
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-cyber-cyan/15">
                <button type="button" onClick={() => setShowEditGroupModal(false)} className="cyber-btn-secondary px-4 py-2 rounded text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingGroup} className="cyber-btn-primary px-5 py-2 rounded text-xs font-bold">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
