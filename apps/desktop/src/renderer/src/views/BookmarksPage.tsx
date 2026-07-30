import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import { AnimatePresence } from 'framer-motion'
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
  Bell,
  Menu
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'
import { useDebounce } from '../lib/useDebounce.js'
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts.js'
import { useToast } from '../components/Toast.js'
import { CardSkeleton, FolderSkeleton } from '../components/Skeleton.js'
import UserGuideModal from '../components/UserGuideModal.js'
import { db } from '../db/db.js'
import { bookmarkRepository } from '../db/SyncRepository.js'
import { syncManager, SyncState } from '../db/SyncManager.js'

export default function BookmarksPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

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
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts([
    {
      key: '/',
      preventInputFocus: false,
      handler: (e) => {
        if (searchInputRef.current) {
          e.preventDefault()
          searchInputRef.current.focus()
        }
      }
    }
  ])

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

  // User Guide state
  const [showUserGuide, setShowUserGuide] = useState(() => {
    return localStorage.getItem('markbel_has_seen_guide') !== 'true'
  })

  const closeUserGuide = () => {
    localStorage.setItem('markbel_has_seen_guide', 'true')
    setShowUserGuide(false)
  }

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
        showToast('Permission Denied', 'Notification permission denied by browser', 'error')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidRes = await api.get<{ publicKey: string }>('/push/vapid-key')
      if (!vapidRes.publicKey) {
        showToast('Error', 'VAPID public key not set on backend', 'error')
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
      showToast('Success', 'Push notifications enabled for this device!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast('Setup Failed', 'Push setup failed: ' + err.message, 'error')
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
      // Offline-first read from local Dexie database
      const data = await db.bookmarks.filter(b => !b.deletedAt).toArray()
      // Sort by latest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
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
    
    // Start background sync
    syncManager.startPeriodicSync()
    
    // Re-load UI when sync finishes pulling new changes
    const unsubscribe = syncManager.subscribe((state) => {
      if (state === SyncState.Idle) {
         loadBookmarks()
      }
    })
    
    // Initial sync
    syncManager.sync()
    
    return unsubscribe
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
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase()
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
  }, [bookmarks, activeGroup, filterStatus, debouncedSearchQuery])

  // Due bookmarks count for top alert bar
  const dueBookmarksList = useMemo(() => {
    const now = new Date().toISOString()
    return bookmarks.filter((b) => !b.isRead && b.remindAt && b.remindAt <= now)
  }, [bookmarks])

  // Auto-fetch metadata when URL is pasted (Debounced)
  useEffect(() => {
    if (!formUrl.trim() || formTitle.trim()) return;
    
    const handler = setTimeout(async () => {
      setIsScrapingMeta(true);
      try {
        const meta = await api.get<{ title: string; description: string; image: string }>(
          `/metadata?url=${encodeURIComponent(formUrl.trim())}`
        );
        if (meta) {
          if (meta.title && !formTitle) setFormTitle(meta.title);
          if (meta.description && !formDescription) setFormDescription(meta.description);
          if (meta.image && !formImage) setFormImage(meta.image);
        }
      } catch (e) {
        console.warn('Scraper failed:', e);
      } finally {
        setIsScrapingMeta(false);
      }
    }, 800);
    
    return () => clearTimeout(handler);
  }, [formUrl]);

  // Toggle Read Status
  const handleToggleRead = async (b: any) => {
    try {
      const updated = await bookmarkRepository.update(b.id, { isRead: !b.isRead })
      if (updated) setBookmarks(bookmarks.map((item) => (item.id === b.id ? updated : item)))
      syncManager.sync()
      loadStats()
    } catch (err) {
      console.error(err)
    }
  }

  // Toggle Pin Status
  const handleTogglePin = async (b: any) => {
    try {
      const updated = await bookmarkRepository.update(b.id, { isPinned: !b.isPinned })
      if (updated) setBookmarks(bookmarks.map((item) => (item.id === b.id ? updated : item)))
      syncManager.sync()
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
      const newB = await bookmarkRepository.create({
        id: crypto.randomUUID(),
        userId: user!.id,
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
      
      syncManager.sync()

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
      const updatedB = await bookmarkRepository.update(selectedBookmark.id, {
        title: formTitle.trim(),
        url: formUrl.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        group: finalGroup,
        remindAt: formRemindAt || ''
      })

      updateGroupColor(finalGroup, selectedColor)
      if (updatedB) setBookmarks(bookmarks.map((b) => (b.id === selectedBookmark.id ? updatedB : b)))
      resetForm()
      setShowEditModal(false)
      
      syncManager.sync()
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
      await bookmarkRepository.delete(bookmarkToDelete.id)
      setBookmarks(bookmarks.filter((b) => b.id !== bookmarkToDelete.id))
      if (selectedBookmark?.id === bookmarkToDelete.id) {
        setShowEditModal(false)
        resetForm()
      }
      setShowDeleteModal(false)
      setBookmarkToDelete(null)
      loadStats()
      
      syncManager.sync()
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
      await bookmarkRepository.update(bookmarkToArchive.id, {
        isArchived: true,
        archiveGroup: archiveGroupInput.trim() || 'archive-general'
      })
      setBookmarks(bookmarks.filter((b) => b.id !== bookmarkToArchive.id))
      setShowArchiveModal(false)
      setBookmarkToArchive(null)
      loadStats()
      
      syncManager.sync()
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
      showToast('Task Pushed', 'Successfully pushed to TickTick', 'success')
    } catch (err: any) {
      showToast('Push Failed', 'Failed to push to TickTick: ' + (err.message || 'Unknown error'), 'error')
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-main)] text-[var(--color-text-primary)] font-sans">
      {/* Sidebar Overlay for Mobile */}
      {!isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? '-translate-x-full md:translate-x-0 w-0 md:w-64' : 'translate-x-0 w-64'
        } fixed md:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]`}
      >
        <div className="p-4 flex items-center justify-between border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-3">
            <MarkbelLogo size={28} />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                Markbel
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveGroup(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                !activeGroup 
                  ? 'bg-[var(--color-bg-element)] text-[var(--color-text-primary)]' 
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              All Bookmarks
            </button>
            <button
              onClick={() => navigate('/archive')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          {/* Groups List */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Collections
              </h3>
              <button 
                onClick={() => { resetForm(); setShowAddModal(true) }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {groups.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No collections yet</div>
              ) : (
                groups.map(group => (
                  <button
                    key={group.name}
                    onClick={() => setActiveGroup(group.name)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md transition-colors ${
                      activeGroup === group.name 
                        ? 'bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-medium' 
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{group.name}</span>
                    </div>
                    <span className="text-xs opacity-60 ml-2">{group.count}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-[var(--color-border-default)]">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-status-error)] hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex-none h-16 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate hidden sm:block">
              {activeGroup ? activeGroup : 'All Bookmarks'}
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="relative w-full max-w-md hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search links (Press /)"
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-md py-1.5 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)] transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button 
              onClick={() => { resetForm(); setShowAddModal(true) }}
              className="btn-primary flex items-center gap-2 px-4 py-1.5 text-sm shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Bookmark</span>
            </button>
          </div>
        </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Urgent "Due Today" Alert Banner */}
          {dueBookmarksList.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">
                    Reading Reminders Due Today ({dueBookmarksList.length})
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You set reminders to read these links today!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilterStatus('due')}
                className="btn-primary px-4 py-2 text-xs shrink-0"
              >
                View Due Reminders
              </button>
            </div>
          )}

          {/* Resurface Discovery Card (Random Unread Pick) */}
          {showResurface && resurfaceBookmarks.length > 0 && (
            <section className="studio-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-3">
                <div className="flex items-center gap-2 text-[var(--color-accent)] text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Rediscovery Suggestions</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadResurface}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-bg-hover)]"
                    title="Shuffle rediscovery suggestions"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Shuffle</span>
                  </button>
                  <button
                    onClick={() => setShowResurface(false)}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded-md hover:bg-[var(--color-bg-hover)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {resurfaceBookmarks.map((rb) => (
                  <div
                    key={rb.id}
                    onClick={() => handleCardClick(rb.url)}
                    className="border border-[var(--color-border-default)] hover:border-[var(--color-border-focused)] bg-[var(--color-bg-surface)] p-3 rounded-md cursor-pointer group transition-all"
                  >
                    <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
                      {rb.group}
                    </span>
                    <h5 className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] line-clamp-1 mb-1">
                      {rb.title}
                    </h5>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {getDomain(rb.url)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

      {/* Filter Tabs & Controls */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-md p-1 text-sm font-medium w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded transition-colors ${
              filterStatus === 'all' ? 'bg-[var(--color-bg-elevated)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('unread')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded transition-colors ${
              filterStatus === 'unread' ? 'bg-[var(--color-bg-elevated)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilterStatus('read')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded transition-colors ${
              filterStatus === 'read' ? 'bg-[var(--color-bg-elevated)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Read
          </button>
          <button
            onClick={() => setFilterStatus('due')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded transition-colors ${
              filterStatus === 'due' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Due
          </button>
        </div>
      </section>

      {/* Main Grid View */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--color-text-muted)] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            <span className="text-sm">Loading bookmarks...</span>
          </div>
        ) : (
          <div>
            {bookmarks.length === 0 ? (
              /* Global Empty State - Onboarding */
              <div className="max-w-2xl mx-auto mt-12 studio-card p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-[var(--color-bg-element)] text-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-2">
                  <BookmarkCheck className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Welcome to Markbel
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto leading-relaxed">
                  Your clean, high-performance link vault. Save links, organize them in collections, and set reminders to read them later.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => { resetForm(); setShowAddModal(true) }}
                    className="btn-primary px-6 py-2.5 flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save Your First Link</span>
                  </button>
                </div>
              </div>
            ) : filteredBookmarks.length === 0 ? (
              /* Filter Empty State */
              <div className="text-center py-20 studio-card rounded-md max-w-md mx-auto border-dashed">
                <FolderOpen className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3 opacity-50" />
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">No matches found</h3>
                <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto mb-4">
                  Try changing your search terms or filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mt-6">
                {filteredBookmarks.map((b) => (
                  <div 
                    key={b.id} 
                    onClick={() => handleCardClick(b.url)}
                    className={`studio-card studio-card-hover flex flex-col justify-between group cursor-pointer ${
                      b.isRead ? 'opacity-70 hover:opacity-100' : ''
                    }`}
                  >
                    <div>
                      {/* Image Thumbnail with Overlay Actions */}
                      <div className="relative aspect-[1.91/1] bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] opacity-20">
                          <LinkIcon className="w-8 h-8" />
                        </div>
                        
                        {b.image && (
                          <img 
                            src={b.image} 
                            alt={b.title} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(b.id, b.url); }}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                            title="Copy Link URL"
                          >
                            {copiedId === b.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(b); }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                              b.isPinned ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                            title={b.isPinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openTickTick(b); }}
                            className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 flex items-center justify-center transition-colors font-bold"
                            title="Push to TickTick Task"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openArchive(b); }}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                            title="Archive Bookmark"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="text-[10px] font-semibold text-[var(--color-bg-surface)] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-sm shadow-sm truncate max-w-[120px]">
                              {b.group || 'Unsorted'}
                            </span>
                            {b.isPinned && (
                              <span className="text-[10px] font-semibold text-amber-900 bg-amber-400/90 backdrop-blur-md px-1.5 py-0.5 rounded-sm shadow-sm" title="Pinned">
                                📌
                              </span>
                            )}
                          </div>
                          {!b.isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" title="Unread" />
                          )}
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] font-medium text-[var(--color-text-muted)] truncate">
                              {getDomain(b.url)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleRead(b); }}
                            className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold transition-colors border ${
                              b.isRead 
                                ? 'bg-transparent border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]' 
                                : 'bg-[var(--color-accent)]/10 border-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                            }`}
                          >
                            {b.isRead ? 'Read ✓' : 'Mark Read'}
                          </button>
                        </div>

                        <h4 className="font-semibold text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2">
                          {b.title}
                        </h4>
                        {b.description && (
                          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                            {b.description}
                          </p>
                        )}

                        {/* Reminder Badge */}
                        {b.remindAt && (
                          <div className="pt-2 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Remind: {new Date(b.remindAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer actions */}
                    <div className="px-4 py-3 border-t border-[var(--color-border-default)] flex items-center justify-between bg-[var(--color-bg-surface)]">
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(b); }}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] hover:bg-red-50 rounded-md p-1.5 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-blue-50 rounded-md p-1.5 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </main>
    </div>

      {/* User Guide Modal */}
      <AnimatePresence>
        {showUserGuide && (
          <UserGuideModal onClose={closeUserGuide} />
        )}
      </AnimatePresence>

      {/* Add Bookmark Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Add Bookmark</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/..." 
                  className="flex-1 studio-input px-3.5 py-2.5 text-sm"
                  required
                />
                {isScrapingMeta && (
                  <div className="flex items-center justify-center px-3 border border-[var(--color-border-default)] rounded-md bg-[var(--color-bg-element)] text-[var(--color-text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Title</label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Title details" 
                  className="w-full studio-input px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Description</label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Write description notes..." 
                  rows={2}
                  className="w-full studio-input px-3.5 py-2.5 text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Group</label>
                  <select
                    value={formGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormGroup(val);
                      const color = groupColors[val] || defaultGroupColors[val] || 'cyan';
                      setSelectedColor(color);
                    }}
                    className="w-full studio-input px-3 py-2.5 text-sm"
                  >
                    <option value="Read Later">Read Later</option>
                    <option value="Inspiration">Inspiration</option>
                    <option value="Development">Development</option>
                    <option value="Resources">Resources</option>
                    <option value="Unsorted">Unsorted</option>
                    {groups.map(g => (
                      !['Read Later', 'Inspiration', 'Development', 'Resources', 'Unsorted'].includes(g.name) && (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      )
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Or Create Group</label>
                  <input 
                    type="text"
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    placeholder="New Group Name" 
                    className="w-full studio-input px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-default)]">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary px-5 py-2 text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Edit Bookmark</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">URL</label>
                <input 
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/..." 
                  className="w-full studio-input px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Title</label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Title details" 
                  className="w-full studio-input px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Description</label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Write description notes..." 
                  rows={2}
                  className="w-full studio-input px-3.5 py-2.5 text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Reminder Date & Time</label>
                <input 
                  type="datetime-local"
                  value={formRemindAt}
                  onChange={(e) => setFormRemindAt(e.target.value)}
                  className="w-full studio-input px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Group</label>
                  <select
                    value={formGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormGroup(val);
                      const color = groupColors[val] || defaultGroupColors[val] || 'cyan';
                      setSelectedColor(color);
                    }}
                    className="w-full studio-input px-3 py-2.5 text-sm"
                  >
                    {groups.map(g => (
                      <option key={g.name} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Or Move to New</label>
                  <input 
                    type="text"
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    placeholder="New Group Name" 
                    className="w-full studio-input px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-default)]">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary px-5 py-2 text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-blue-600">
                <span className="font-bold text-lg">✓</span>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Push to TickTick Task</h3>
              </div>
              <button 
                onClick={() => setShowTickTickModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!ticktickConnected ? (
              <div className="space-y-4 py-2 text-center">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Your TickTick account is not connected yet. Connect your account in Settings to push bookmarks as tasks.
                </p>
                <button
                  onClick={() => { setShowTickTickModal(false); navigate('/settings'); }}
                  className="btn-primary px-4 py-2 text-xs font-bold"
                >
                  Open Settings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[var(--color-bg-element)] border border-[var(--color-border-default)] p-3 rounded-md text-xs space-y-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-semibold block uppercase">Bookmark Title</span>
                  <span className="text-[var(--color-text-primary)] font-semibold block truncate">{bookmarkToPush.title}</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 block">Select TickTick Project</label>
                  <select
                    value={selectedTicktickProject}
                    onChange={(e) => setSelectedTicktickProject(e.target.value)}
                    className="w-full studio-input px-3 py-2.5 text-sm"
                  >
                    {ticktickProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 block">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={ticktickDueDate}
                    onChange={(e) => setTicktickDueDate(e.target.value)}
                    className="w-full studio-input px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border-default)]">
                  <button
                    type="button"
                    onClick={() => setShowTickTickModal(false)}
                    className="btn-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmPushTickTick}
                    disabled={isPushingTicktick}
                    className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-500">
                <Archive className="w-5 h-5" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Archive Bookmark</h3>
              </div>
              <button 
                onClick={() => setShowArchiveModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Move <strong>"{bookmarkToArchive.title}"</strong> to archive?
              </p>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Archive Sub-Group (Optional)</label>
                <input 
                  type="text"
                  value={archiveGroupInput}
                  onChange={(e) => setArchiveGroupInput(e.target.value)}
                  placeholder="archive-dev" 
                  className="w-full studio-input px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border-default)]">
                <button 
                  type="button" 
                  onClick={() => setShowArchiveModal(false)}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmArchive}
                  className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-5 py-2 rounded-md text-xs font-bold transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--color-status-error)]">Confirm Delete</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">
              Permanently delete <strong>"{bookmarkToDelete.title}"</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary px-4 py-2 text-xs">
                Cancel
              </button>
              <button onClick={confirmDelete} className="btn-danger px-5 py-2 text-xs font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="studio-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Edit Group Name</h3>
              <button onClick={() => setShowEditGroupModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <input
                type="text"
                value={formGroupName}
                onChange={(e) => setFormGroupName(e.target.value)}
                className="w-full studio-input px-3.5 py-2.5 text-sm"
                required
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border-default)]">
                <button type="button" onClick={() => setShowEditGroupModal(false)} className="btn-secondary px-4 py-2 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingGroup} className="btn-primary px-5 py-2 text-xs font-bold">
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
