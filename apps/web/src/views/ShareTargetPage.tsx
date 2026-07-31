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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewGroupInput(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-default)] p-4 relative overflow-hidden">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] relative z-10" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-bg-default)] relative overflow-hidden text-[var(--color-text-primary)]">
      <div className="w-full max-w-lg relative z-10">
        <button 
          onClick={() => navigate('/')} 
          className="mb-4 flex items-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer bg-white hover:bg-gray-50 px-3.5 py-2 border border-[var(--color-border-default)] rounded-md shadow-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Back to Vault</span>
        </button>

        <div className="studio-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 border border-[var(--color-border-default)] text-[var(--color-accent)] bg-blue-50 flex items-center justify-center rounded-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">Quick Save Bookmark</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5 font-medium">
                Save shared resource to your Markbel vault
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {image && (
              <div className="relative aspect-video w-full rounded-md overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-element)] shadow-sm">
                <img 
                  src={image} 
                  alt="Link preview" 
                  className="w-full h-full object-cover"
                  onError={() => setImage('')} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-3">
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm">
                    Preview
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">URL</label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => url.trim() && fetchLinkMeta(url)}
                  placeholder="https://example.com"
                  className="w-full studio-input pl-10 pr-4 py-2.5 text-sm"
                  required
                />
                <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-muted)]">Title</label>
                {isLoadingMeta && (
                  <span className="text-[10px] font-bold text-[var(--color-accent)] animate-pulse flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching info...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Link Title"
                className="w-full studio-input px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Notes / Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes, highlights, takeaways..."
                rows={3}
                className="w-full studio-input px-4 py-2.5 text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Collection</label>
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
                    className="flex-1 studio-input px-3 py-2.5 text-sm"
                  >
                    {existingGroups.map(group => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(true)}
                    className="btn-secondary rounded-md p-2.5 flex items-center justify-center shrink-0"
                    title="Create new collection"
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
                    className="flex-1 studio-input px-4 py-2.5 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewGroupInput(false)
                      setNewGroupInput('')
                    }}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2.5 cursor-pointer bg-[var(--color-bg-element)] rounded-md border border-[var(--color-border-default)] flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Collection Custom Color</label>
              <div className="flex gap-2.5 pt-1">
                {(['cyan', 'pink', 'green', 'yellow'] as const).map((color) => {
                  const colorClasses = {
                    cyan: 'bg-blue-500 border-blue-600 text-white',
                    pink: 'bg-pink-500 border-pink-600 text-white',
                    green: 'bg-green-500 border-green-600 text-white',
                    yellow: 'bg-amber-500 border-amber-600 text-white',
                  }
                  const borderClasses = {
                    cyan: 'border-blue-200 hover:border-blue-500 bg-blue-50',
                    pink: 'border-pink-200 hover:border-pink-500 bg-pink-50',
                    green: 'border-green-200 hover:border-green-500 bg-green-50',
                    yellow: 'border-amber-200 hover:border-amber-500 bg-amber-50',
                  }
                  const isSelected = selectedColor === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                        isSelected ? `${colorClasses[color]} scale-110` : `bg-transparent ${borderClasses[color]}`
                      }`}
                      title={`Set collection color to ${color}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 text-sm bg-red-50 border border-red-200 text-[var(--color-status-error)] rounded-md font-semibold text-center">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 btn-secondary py-2.5 text-sm"
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                type="submit"
                className="flex-1 btn-primary py-2.5 text-sm font-bold"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
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
