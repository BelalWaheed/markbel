import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import {
  ArrowLeft,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  Search,
  Folder,
  Loader2,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function ArchivePage() {
  const navigate = useNavigate()
  const [archivedBookmarks, setArchivedBookmarks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeArchiveGroup, setActiveArchiveGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadArchivedBookmarks = async () => {
    try {
      const data = await api.get<any[]>('/bookmarks/archived')
      setArchivedBookmarks(data)
    } catch (err) {
      console.error('Failed to load archived bookmarks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchivedBookmarks()
  }, [])

  const archiveGroups = useMemo(() => {
    const map = new Map<string, number>()
    archivedBookmarks.forEach((b) => {
      const g = b.archiveGroup || 'archive-general'
      map.set(g, (map.get(g) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [archivedBookmarks])

  const filteredBookmarks = useMemo(() => {
    let result = archivedBookmarks
    if (activeArchiveGroup) {
      result = result.filter((b) => (b.archiveGroup || 'archive-general') === activeArchiveGroup)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          (b.archiveGroup || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [archivedBookmarks, activeArchiveGroup, searchQuery])

  const handleUnarchive = async (id: string) => {
    try {
      await api.patch(`/bookmarks/unarchive?id=${id}`)
      setArchivedBookmarks(archivedBookmarks.filter((b) => b.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this archived bookmark?')) return
    try {
      await api.delete(`/bookmarks?id=${id}`)
      setArchivedBookmarks(archivedBookmarks.filter((b) => b.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const getDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr)
      return url.hostname.replace('www.', '')
    } catch {
      return urlStr
    }
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 min-h-screen relative overflow-x-hidden font-mono text-slate-200">
      {/* Cyber Grid & Scanline Backplates */}
      <div className="fixed inset-0 pointer-events-none z-0 cyber-grid" />
      <div className="fixed inset-0 pointer-events-none z-0 cyber-scanlines opacity-20" />

      {/* Header */}
      <header className="cyber-card px-5 py-4 rounded flex items-center justify-between shadow-2xl relative z-10 border border-cyber-yellow/35 bg-black/90">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyber-yellow via-cyber-pink to-cyber-cyan" />

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="cyber-btn-secondary p-2 rounded text-cyber-yellow hover:text-white transition-colors"
            title="Back to Vault"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <MarkbelLogo size={32} />
          <div>
            <h1 className="text-lg font-black tracking-widest text-white uppercase flex items-center gap-2">
              <Archive className="w-4 h-4 text-cyber-yellow" />
              <span>Bookmarks Archive</span>
            </h1>
            <p className="text-[9px] text-cyber-yellow font-bold tracking-widest uppercase">Cold Storage Repository</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-black/80 border border-cyber-yellow/30 rounded px-3 py-1.5 w-48 sm:w-64">
          <Search className="w-3.5 h-3.5 text-cyber-yellow/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archive..."
            className="bg-transparent text-xs text-cyber-yellow placeholder-cyber-yellow/30 outline-none w-full font-bold"
          />
        </div>
      </header>

      {/* Navigation Sub-groups */}
      <section className="flex flex-wrap items-center gap-2 relative z-10">
        <button
          onClick={() => setActiveArchiveGroup(null)}
          className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
            activeArchiveGroup === null
              ? 'bg-cyber-yellow text-black border border-cyber-yellow shadow-[0_0_10px_rgba(255,230,0,0.3)]'
              : 'bg-black/80 text-slate-300 border border-white/10 hover:border-cyber-yellow'
          }`}
        >
          All Archive ({archivedBookmarks.length})
        </button>

        {archiveGroups.map((g) => (
          <button
            key={g.name}
            onClick={() => setActiveArchiveGroup(g.name)}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
              activeArchiveGroup === g.name
                ? 'bg-cyber-yellow text-black border border-cyber-yellow shadow-[0_0_10px_rgba(255,230,0,0.3)]'
                : 'bg-black/80 text-slate-300 border border-white/10 hover:border-cyber-yellow'
            }`}
          >
            📁 {g.name} ({g.count})
          </button>
        ))}
      </section>

      {/* Content */}
      <main className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyber-yellow" />
            <span className="text-[10px] tracking-widest text-cyber-yellow/50 uppercase">Accessing Archive Vault...</span>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="text-center py-20 cyber-card rounded border-dashed border-cyber-yellow/20 max-w-md mx-auto bg-black/80 space-y-3">
            <Archive className="w-12 h-12 mx-auto text-cyber-yellow/40" />
            <h3 className="text-sm font-bold text-white uppercase">No Archived Bookmarks</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto font-sans">
              Bookmarks you archive will be safely stored here in custom sub-groups without cluttering your main vault.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredBookmarks.map((b) => (
              <div
                key={b.id}
                className="cyber-card rounded overflow-hidden flex flex-col justify-between border border-cyber-yellow/20 bg-black/85 relative group"
              >
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyber-yellow bg-black border border-cyber-yellow/30 px-2 py-0.5">
                      📁 {b.archiveGroup || 'archive-general'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">
                      Originally in: {b.group || 'Unsorted'}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug">
                    {b.title}
                  </h4>

                  {b.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                      {b.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-[10px] text-cyber-cyan truncate pt-1">
                    <Sparkles className="w-3 h-3 text-cyber-yellow shrink-0" />
                    <span className="truncate">{getDomain(b.url)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-cyber-yellow/15 flex items-center justify-between bg-black/60">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyber-cyan hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Visit Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnarchive(b.id)}
                      className="cyber-btn-primary text-[10px] px-2.5 py-1 rounded flex items-center gap-1 font-bold"
                      title="Restore to Main Vault"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Unarchive</span>
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-slate-400 hover:text-red-400 p-1 rounded"
                      title="Delete Permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
