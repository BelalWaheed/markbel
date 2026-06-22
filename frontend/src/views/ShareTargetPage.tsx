import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.js'
import { Loader2, Link as LinkIcon, Sparkles, FolderPlus, Check, X, ArrowLeft } from 'lucide-react'

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('Read Later')
  const [newGroupInput, setNewGroupInput] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [existingGroups, setExistingGroups] = useState<string[]>(['Read Later', 'Inspiration', 'Resources'])

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const currentParams = searchParams.toString()
      const redirectPath = `/login?redirect=${encodeURIComponent(`/share-target?${currentParams}`)}`
      navigate(redirectPath, { replace: true })
    }
  }, [user, authLoading, searchParams, navigate])

  // Localized custom group colors mapping state
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

  // 1. Fetch current bookmarks to extract existing groups
  useEffect(() => {
    async function loadGroups() {
      try {
        const bookmarks = await api.get<any[]>('/bookmarks')
        const groups = bookmarks.map(b => b.group || 'Unsorted')
        const set = new Set(['Read Later', 'Inspiration', 'Resources', ...groups])
        setExistingGroups(Array.from(set).filter(Boolean))
      } catch (err) {
        console.warn('Failed to load existing groups:', err)
      }
    }
    loadGroups()
  }, [])

  // 2. Extract shared URL, title and text on mount
  useEffect(() => {
    const paramTitle = searchParams.get('title') || ''
    const paramText = searchParams.get('text') || ''
    const paramUrl = searchParams.get('url') || ''

    let extractedUrl = paramUrl.trim()
    let extractedTitle = paramTitle.trim()
    let extractedDesc = paramText.trim()

    // Android/browser share target url resolution fallback
    if (!extractedUrl && paramText) {
      const urlRegex = /(https?:\/\/[^\s]+)/
      const match = paramText.match(urlRegex)
      if (match) {
        extractedUrl = match[0]
        extractedDesc = paramText.replace(extractedUrl, '').trim()
      }
    }

    setUrl(extractedUrl)
    setTitle(extractedTitle || 'Shared Bookmark')
    setDescription(extractedDesc)

    if (extractedUrl) {
      fetchLinkMeta(extractedUrl)
    }
  }, [searchParams])

  // Fetch link meta
  const fetchLinkMeta = async (targetUrl: string) => {
    setIsLoadingMeta(true)
    setErrorMessage('')
    try {
      const meta = await api.get<{ title: string; description: string; image: string }>(
          `/bookmarks/meta?url=${encodeURIComponent(targetUrl)}`
      )
      if (meta) {
        if (meta.title) setTitle(meta.title)
        if (meta.description) setDescription(meta.description)
        if (meta.image) setImage(meta.image)
      }
    } catch (err: any) {
      console.warn('Failed to scrape webpage metadata:', err)
    } finally {
      setIsLoadingMeta(false)
    }
  }

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setErrorMessage('A valid URL is required')
      return
    }

    const groupToSave = showNewGroupInput && newGroupInput.trim() 
        ? newGroupInput.trim() 
        : selectedGroup

    setIsSaving(true)
    setErrorMessage('')

    try {
      // Save new group color mapping
      const updated = { ...groupColors, [groupToSave]: selectedColor }
      setGroupColors(updated)
      localStorage.setItem('markbel_group_colors', JSON.stringify(updated))

      await api.post('/bookmarks', {
        title: title || url,
        url,
        description,
        image,
        group: groupToSave
      })

      // Redirect to Bookmarks
      navigate('/')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save bookmark')
      setIsSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
        <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-25" />
        <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan relative z-10" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Cyber Grid & Scanline Backplates */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-25" />

      {/* Cyber Glowing Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-20 -right-20 w-[450px] h-[450px] cyber-glow-cyan rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-[450px] h-[450px] cyber-glow-pink rounded-full" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <button 
          onClick={() => navigate('/')} 
          className="mb-4 flex items-center text-xs text-cyber-cyan hover:text-white transition-colors cursor-pointer bg-black/80 hover:bg-black px-3.5 py-2 border border-cyber-cyan/35 rounded"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Back to Vault</span>
        </button>

        <div className="cyber-card p-6 rounded shadow-2xl border border-cyber-cyan/35 bg-black/90">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyber-cyan to-cyber-pink" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 border border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-cyber-cyan blur-md opacity-20" />
              <Sparkles className="w-5 h-5 fill-current relative z-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase">Quick Save Bookmark</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Save shared resource to your Markbel vault
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {image && (
              <div className="relative aspect-video w-full rounded overflow-hidden border border-cyber-cyan/20 bg-black shadow-md">
                <img 
                  src={image} 
                  alt="Link preview" 
                  className="w-full h-full object-cover"
                  onError={() => setImage('')} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent flex items-end p-3">
                  <span className="text-[9px] text-cyber-cyan font-bold uppercase tracking-widest bg-black border border-cyber-cyan/35 px-2 py-0.5 shadow-sm font-mono">
                    Preview
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">URL</label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => url.trim() && fetchLinkMeta(url)}
                  placeholder="https://example.com"
                  className="w-full cyber-input rounded pl-10 pr-4 py-2.5 text-xs font-bold font-sans"
                  required
                />
                <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-cyan/60" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Title</label>
                {isLoadingMeta && (
                  <span className="text-[9px] font-bold text-cyber-green animate-pulse flex items-center gap-1 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching info...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Link Title"
                className="w-full cyber-input rounded px-4 py-2.5 text-xs font-bold font-sans"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Notes / Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes, highlights, takeaways..."
                rows={3}
                className="w-full cyber-input rounded px-4 py-2.5 text-xs resize-none font-sans"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Group</label>
              {!showNewGroupInput ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedGroup(val);
                      const color = groupColors[val] || defaultGroupColors[val] || 'cyan';
                      setSelectedColor(color);
                    }}
                    className="flex-1 cyber-input rounded px-3 py-2.5 text-xs font-sans bg-black text-cyber-cyan"
                  >
                    {existingGroups.map(group => (
                      <option key={group} value={group} className="bg-black text-cyber-cyan font-sans">
                        {group}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(true)}
                    className="cyber-btn-secondary rounded p-2.5 flex items-center justify-center shrink-0"
                    title="Create new folder group"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    placeholder="New group name..."
                    className="flex-1 cyber-input rounded px-4 py-2.5 text-xs font-sans"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewGroupInput(false)
                      setNewGroupInput('')
                    }}
                    className="text-cyber-pink hover:text-white transition-colors p-2.5 cursor-pointer bg-cyber-pink/5 rounded border border-cyber-pink/25 flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
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

            {errorMessage && (
              <div className="p-3 text-xs bg-cyber-pink/10 border border-cyber-pink/35 text-cyber-pink rounded font-semibold text-center uppercase">
                Error: {errorMessage}
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-cyber-cyan/15">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 cyber-btn-secondary py-2.5 rounded text-xs"
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                type="submit"
                className="flex-1 cyber-btn-primary py-2.5 rounded text-xs font-bold"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2 font-mono text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Save Link
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
