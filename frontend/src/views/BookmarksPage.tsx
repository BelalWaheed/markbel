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
  Sparkles
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function BookmarksPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // View states
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
  const [newGroupInput, setNewGroupInput] = useState('')
  const [isScrapingMeta, setIsScrapingMeta] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Custom themed delete confirmation states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookmarkToDelete, setBookmarkToDelete] = useState<any>(null)

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

  // Fetch bookmarks
  const loadBookmarks = async () => {
    try {
      const data = await api.get<any[]>('/bookmarks')
      setBookmarks(data)
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookmarks()
  }, [])

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    const storedToken = localStorage.getItem('markbel_token')
    if (!storedToken || !user) return

    const sseUrl = `/api/bookmarks/events?token=${encodeURIComponent(storedToken)}`
    const eventSource = new EventSource(sseUrl)

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
      eventSource.close()
    }

    return () => {
      eventSource.close()
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

  // Filtered bookmarks based on active group + search query
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks
    if (activeGroup && !searchQuery.trim()) {
      result = result.filter((b) => (b.group || 'Unsorted') === activeGroup)
    }
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
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [bookmarks, activeGroup, searchQuery])

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

  // Add Bookmark Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formUrl.trim()) return
    const finalGroup = newGroupInput.trim() || formGroup
    setIsSaving(true)

    try {
      const newB = await api.post('/bookmarks', {
        title: formTitle.trim() || formUrl.trim(),
        url: formUrl.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        group: finalGroup
      })

      // Update custom group color
      updateGroupColor(finalGroup, selectedColor)

      setBookmarks([newB, ...bookmarks])
      resetForm()
      setShowAddModal(false)

      // Schedule background updates as scraping completes
      setTimeout(() => {
        loadBookmarks()
      }, 3000)
      setTimeout(() => {
        loadBookmarks()
      }, 6000)
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
      const updatedB = await api.put(`/bookmarks?id=${selectedBookmark.id}`, {
        title: formTitle.trim(),
        url: formUrl.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        group: finalGroup
      })

      // Update custom group color
      updateGroupColor(finalGroup, selectedColor)

      setBookmarks(bookmarks.map(b => b.id === selectedBookmark.id ? updatedB : b))
      resetForm()
      setShowEditModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Bookmark Confirmation & Handlers
  const handleDeleteClick = (b: any) => {
    setBookmarkToDelete(b)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!bookmarkToDelete) return
    try {
      await api.delete(`/bookmarks?id=${bookmarkToDelete.id}`)
      setBookmarks(bookmarks.filter(b => b.id !== bookmarkToDelete.id))
      if (selectedBookmark?.id === bookmarkToDelete.id) {
        setShowEditModal(false)
        resetForm()
      }
      setShowDeleteModal(false)
      setBookmarkToDelete(null)
    } catch (err) {
      console.error(err)
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
        // Bulk rename bookmarks belonging to this group in DB
        await api.put('/bookmarks/group', { oldName, newName })
        
        // Update bookmarks state locally
        setBookmarks(bookmarks.map(b => b.group === oldName ? { ...b, group: newName } : b))
        
        // Update group color mapping
        renameGroupColor(oldName, newName, formGroupColor)

        // If the old group was the active view filter, update it
        if (activeGroup === oldName) {
          setActiveGroup(newName)
        }
      } else {
        // Just update color
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

  // Cyber styling color mapper
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
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 min-h-screen relative overflow-x-hidden">
      {/* Cyber Grid & Scanline Backplates */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-20" />

      {/* Cyber Glowing Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] right-[10%] w-[550px] h-[550px] cyber-glow-cyan rounded-full" />
        <div className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] cyber-glow-pink rounded-full" />
      </div>

      {/* Header Navbar */}
      <header className="cyber-card px-5 py-4 rounded flex items-center justify-between shadow-2xl relative z-10 border border-cyber-cyan/35 bg-black/90">
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

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-white/5 px-3 py-1.5 rounded text-xs text-slate-300">
            <UserIcon className="w-3.5 h-3.5 text-cyber-cyan" />
            <span className="max-w-[120px] truncate font-medium">{user?.name}</span>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 text-xs cyber-btn-danger px-3 py-1.5 rounded"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

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
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto font-mono">
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
        ) : searchQuery.trim() || activeGroup ? (
          /* Bookmarks List View within Group or Search */
          <div>
            {filteredBookmarks.length === 0 ? (
              <div className="text-center py-20 cyber-card rounded border-dashed border-cyber-cyan/20 max-w-md mx-auto bg-black/80">
                <FolderOpen className="w-12 h-12 mx-auto text-cyber-cyan/40 mb-3" />
                <h3 className="text-sm font-mono font-bold text-white uppercase mb-1">No bookmarks found</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                  Add links manually or use sharing targets.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                {filteredBookmarks.map((b) => (
                  <div 
                    key={b.id} 
                    onClick={() => handleCardClick(b.url)}
                    className="cyber-card cyber-card-hover rounded overflow-hidden flex flex-col justify-between group border-cyber-cyan/20 bg-black/85 relative cursor-pointer"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-cyan opacity-40 group-hover:bg-cyber-pink group-hover:opacity-100 transition-colors" />

                    <div>
                      {/* Image Thumbnail with Overlay Actions */}
                      <div className="relative aspect-video bg-black border-b border-cyber-cyan/15 overflow-hidden">
                        {/* Persistent background placeholder icon */}
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
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px] z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(b.id, b.url); }}
                            className="w-9 h-9 border border-cyber-cyan/40 bg-black hover:border-cyber-cyan text-cyber-cyan flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                            title="Copy Link URL"
                          >
                            {copiedId === b.id ? <Check className="w-4 h-4 text-cyber-green" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 z-10 font-mono">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-cyber-cyan bg-black border border-cyber-cyan/30 px-2 py-0.5 shadow-sm">
                            {b.group || 'Unsorted'}
                          </span>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-3.5 sm:p-5 space-y-1 sm:space-y-2">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Sparkles className="w-3 h-3 text-cyber-yellow shrink-0 animate-pulse" />
                          <span className="text-[8px] sm:text-[9px] font-bold text-cyber-cyan/70 uppercase tracking-widest block truncate">
                            {getDomain(b.url)}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-white leading-snug line-clamp-2 group-hover:text-cyber-cyan transition-colors font-sans">
                          {b.title}
                        </h4>
                        {b.description && (
                          <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed line-clamp-2 sm:line-clamp-3 font-sans font-medium">
                            {b.description}
                          </p>
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
                          className="flex items-center gap-1 sm:gap-1.5 border border-cyber-cyan/30 hover:border-cyber-cyan bg-cyber-cyan/5 text-cyber-cyan text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 rounded transition-all cursor-pointer font-bold active:scale-95 animate-pulse"
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
                {/* Onboarding Guide Card */}
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
                      Markbel is a premium, high-performance link vault. Here is how to use the app in seconds:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2 text-left">
                      {/* Step 1 */}
                      <div className="border border-cyber-cyan/20 p-5 rounded bg-cyan-950/5 hover:border-cyber-cyan/50 hover:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all duration-300 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-cyber-cyan font-mono font-bold text-xs sm:text-sm">01 //</span>
                          <h4 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">Quick URL-Only Saves</h4>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-sans font-medium">
                          Just paste any URL and click <strong>Create</strong>. You don't need to enter a title or description; the app automatically scrapes details in the background.
                        </p>
                      </div>

                      {/* Step 2 (Mobile Share) */}
                      <div className="border border-cyber-yellow/20 p-5 rounded bg-yellow-950/5 hover:border-cyber-yellow/50 hover:shadow-[0_0_15px_rgba(255,230,0,0.1)] transition-all duration-300 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-cyber-yellow font-mono font-bold text-xs sm:text-sm">02 //</span>
                          <h4 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">Mobile Share Actions</h4>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-sans font-medium">
                          Access Markbel on the go. Share any webpage or link from your mobile device's native share sheet directly into your bookmark vault.
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

                {/* Quick create card */}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-lg p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-cyan bg-black">
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
                  {isScrapingMeta && <span className="text-[10px] text-cyber-green font-bold animate-pulse font-mono">Fetching info...</span>}
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
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Thumbnail Image URL</label>
                <input 
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="https://example.com/image.jpg" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
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
                    {!groups.some(g => g.name === 'Read Later') && <option value="Read Later" className="bg-black text-cyber-cyan">Read Later</option>}
                    {!groups.some(g => g.name === 'Inspiration') && <option value="Inspiration" className="bg-black text-cyber-cyan">Inspiration</option>}
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

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group Custom Color</label>
                <div className="flex gap-2.5 pt-1">
                  {(['cyan', 'pink', 'green', 'yellow'] as const).map((color) => {
                    const colorClasses = {
                      cyan: 'bg-cyber-cyan border-cyber-cyan text-black',
                      pink: 'bg-cyber-pink border-cyber-pink text-black',
                      green: 'bg-cyber-green border-cyber-green text-black',
                      yellow: 'bg-cyber-yellow border-cyber-yellow text-black',
                    }
                    const borderClasses = {
                      cyan: 'border-cyber-cyan/50 hover:border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5',
                      pink: 'border-cyber-pink/50 hover:border-cyber-pink text-cyber-pink bg-cyber-pink/5',
                      green: 'border-cyber-green/50 hover:border-cyber-green text-cyber-green bg-cyber-green/5',
                      yellow: 'border-cyber-yellow/50 hover:border-cyber-yellow text-cyber-yellow bg-cyber-yellow/5',
                    }
                    const isSelected = selectedColor === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                          isSelected ? `${colorClasses[color]} scale-110 shadow-[0_0_8px_rgba(255,255,255,0.45)]` : `bg-transparent ${borderClasses[color]}`
                        }`}
                        title={`Set group color to ${color}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                      </button>
                    )
                  })}
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

      {/* Edit Modal */}
      {showEditModal && selectedBookmark && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-lg p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-pink bg-black">
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
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Thumbnail Image URL</label>
                <input 
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="https://example.com/image.jpg" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
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

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group Custom Color</label>
                <div className="flex gap-2.5 pt-1">
                  {(['cyan', 'pink', 'green', 'yellow'] as const).map((color) => {
                    const colorClasses = {
                      cyan: 'bg-cyber-cyan border-cyber-cyan text-black',
                      pink: 'bg-cyber-pink border-cyber-pink text-black',
                      green: 'bg-cyber-green border-cyber-green text-black',
                      yellow: 'bg-cyber-yellow border-cyber-yellow text-black',
                    }
                    const borderClasses = {
                      cyan: 'border-cyber-cyan/50 hover:border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5',
                      pink: 'border-cyber-pink/50 hover:border-cyber-pink text-cyber-pink bg-cyber-pink/5',
                      green: 'border-cyber-green/50 hover:border-cyber-green text-cyber-green bg-cyber-green/5',
                      yellow: 'border-cyber-yellow/50 hover:border-cyber-yellow text-cyber-yellow bg-cyber-yellow/5',
                    }
                    const isSelected = selectedColor === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                          isSelected ? `${colorClasses[color]} scale-110 shadow-[0_0_8px_rgba(255,255,255,0.45)]` : `bg-transparent ${borderClasses[color]}`
                        }`}
                        title={`Set group color to ${color}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cyber-cyan/15">
                <button 
                  type="button" 
                  onClick={() => {
                    setBookmarkToDelete(selectedBookmark)
                    setShowDeleteModal(true)
                  }}
                  className="flex items-center gap-1.5 text-xs text-red-400 bg-red-955/20 hover:bg-red-955/40 border border-red-900/35 px-4 py-2.5 rounded cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex gap-2">
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
                    {isSaving ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && bookmarkToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-pink bg-black">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-pink" />
            
            <div className="flex items-center gap-3 text-cyber-pink font-mono text-xs font-bold uppercase tracking-widest mb-4">
              <Trash2 className="w-4 h-4 animate-pulse" />
              <span>Warning // System Purge</span>
            </div>

            <h3 className="text-sm font-mono font-bold text-white uppercase mb-2">Confirm Bookmark Deletion</h3>
            <p className="text-xs text-slate-400 mb-6 font-sans leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-cyber-cyan break-all">{bookmarkToDelete.title}</strong>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-cyber-cyan/15 font-mono">
              <button 
                type="button" 
                onClick={() => { setShowDeleteModal(false); setBookmarkToDelete(null); }}
                className="cyber-btn-secondary px-4 py-2.5 rounded text-xs"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmDelete}
                className="flex items-center gap-1.5 text-xs text-red-400 bg-red-955/20 hover:bg-red-955/40 border border-red-900/35 px-5 py-2.5 rounded cursor-pointer transition-all active:scale-95 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-md p-6 rounded relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 border-cyber-cyan bg-black">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyber-cyan to-cyber-pink" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white uppercase">Edit Folder Group</h3>
              <button 
                onClick={() => setShowEditGroupModal(false)}
                className="text-cyber-pink hover:text-white cursor-pointer bg-white/5 rounded p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group Name</label>
                <input 
                  type="text"
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value)}
                  placeholder="Group Name" 
                  className="w-full cyber-input rounded px-3.5 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group Custom Color</label>
                <div className="flex gap-2.5 pt-1">
                  {(['cyan', 'pink', 'green', 'yellow'] as const).map((color) => {
                    const colorClasses = {
                      cyan: 'bg-cyber-cyan border-cyber-cyan text-black',
                      pink: 'bg-cyber-pink border-cyber-pink text-black',
                      green: 'bg-cyber-green border-cyber-green text-black',
                      yellow: 'bg-cyber-yellow border-cyber-yellow text-black',
                    }
                    const borderClasses = {
                      cyan: 'border-cyber-cyan/50 hover:border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5',
                      pink: 'border-cyber-pink/50 hover:border-cyber-pink text-cyber-pink bg-cyber-pink/5',
                      green: 'border-cyber-green/50 hover:border-cyber-green text-cyber-green bg-cyber-green/5',
                      yellow: 'border-cyber-yellow/50 hover:border-cyber-yellow text-cyber-yellow bg-cyber-yellow/5',
                    }
                    const isSelected = formGroupColor === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormGroupColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                          isSelected ? `${colorClasses[color]} scale-110 shadow-[0_0_8px_rgba(255,255,255,0.45)]` : `bg-transparent ${borderClasses[color]}`
                        }`}
                        title={`Set group color to ${color}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-cyber-cyan/15">
                <button 
                  type="button" 
                  onClick={() => setShowEditGroupModal(false)}
                  className="cyber-btn-secondary px-4 py-2.5 rounded text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingGroup}
                  className="cyber-btn-primary px-5 py-2.5 rounded text-xs font-bold"
                >
                  {isSavingGroup ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
