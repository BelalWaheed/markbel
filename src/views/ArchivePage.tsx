import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarkbelLogo from "../components/MarkbelLogo.js";
import { db } from "../db/db.js";
import { bookmarkRepository } from "../db/SyncRepository.js";

export default function ArchivePage() {
  const navigate = useNavigate();
  const [archivedBookmarks, setArchivedBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArchiveGroup, setActiveArchiveGroup] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const loadArchivedBookmarks = async () => {
    try {
      const data = await db.bookmarks
        .filter((b) => !!b.isArchived && !b.deletedAt)
        .toArray();
      setArchivedBookmarks(data);
    } catch (err) {
      console.error("Failed to load archived bookmarks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchivedBookmarks();
  }, []);

  const archiveGroups = useMemo(() => {
    const map = new Map<string, number>();
    archivedBookmarks.forEach((b) => {
      const g = b.archiveGroup || "archive-general";
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [archivedBookmarks]);

  const filteredBookmarks = useMemo(() => {
    let result = archivedBookmarks;
    if (activeArchiveGroup) {
      result = result.filter(
        (b) => (b.archiveGroup || "archive-general") === activeArchiveGroup,
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || "").toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          (b.archiveGroup || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [archivedBookmarks, activeArchiveGroup, searchQuery]);

  const handleUnarchive = async (id: string) => {
    try {
      await bookmarkRepository.update(id, {
        isArchived: false,
        archiveGroup: undefined,
      });
      setArchivedBookmarks(archivedBookmarks.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this archived bookmark?")) return;
    try {
      await bookmarkRepository.delete(id);
      setArchivedBookmarks(archivedBookmarks.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace("www.", "");
    } catch {
      return urlStr;
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 min-h-screen relative overflow-x-hidden text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="studio-card px-5 py-4 flex items-center justify-between z-10 border border-[var(--color-border-default)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="btn-secondary p-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Back to Vault"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <MarkbelLogo size={32} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-500" />
              <span>Bookmarks Archive</span>
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-semibold tracking-wide uppercase">
              Cold Storage Repository
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-[var(--color-border-default)] rounded-md px-3 py-1.5 w-48 sm:w-64 shadow-sm">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archive..."
            className="bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none w-full"
          />
        </div>
      </header>

      {/* Navigation Sub-groups */}
      <section className="flex flex-wrap items-center gap-2 relative z-10">
        <button
          onClick={() => setActiveArchiveGroup(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeArchiveGroup === null
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-white text-[var(--color-text-muted)] border border-[var(--color-border-default)] hover:border-amber-300"
          }`}
        >
          All Archive ({archivedBookmarks.length})
        </button>

        {archiveGroups.map((g) => (
          <button
            key={g.name}
            onClick={() => setActiveArchiveGroup(g.name)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeArchiveGroup === g.name
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-white text-[var(--color-text-muted)] border border-[var(--color-border-default)] hover:border-amber-300"
            }`}
          >
            📁 {g.name} ({g.count})
          </button>
        ))}
      </section>

      {/* Content */}
      <main className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--color-text-muted)] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Accessing Archive Vault...
            </span>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="text-center py-20 studio-card border-dashed border-[var(--color-border-default)] max-w-md mx-auto space-y-3">
            <Archive className="w-12 h-12 mx-auto text-[var(--color-text-muted)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase">
              No Archived Bookmarks
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
              Bookmarks you archive will be safely stored here in custom
              sub-groups without cluttering your main vault.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
            {filteredBookmarks.map((b) => (
              <div
                key={b.id}
                className="studio-card flex flex-col justify-between group overflow-hidden"
              >
                {b.image && (
                  <div className="relative aspect-[1.4/1] overflow-hidden bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)]">
                    <img
                      src={b.image}
                      alt={b.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wide text-[var(--color-text-primary)] bg-[var(--color-bg-element)] border border-[var(--color-border-default)] px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[90px] sm:max-w-[150px]">
                      📁 {b.archiveGroup || "archive-general"}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] font-bold uppercase truncate max-w-[80px] sm:max-w-[120px]">
                      {b.group || "Unsorted"}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-[var(--color-text-primary)] line-clamp-2 leading-snug">
                    {b.title}
                  </h4>

                  {b.description && (
                    <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                      {b.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--color-accent)] truncate pt-1 font-semibold">
                    <LinkIcon className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                    <span className="truncate">{getDomain(b.url)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-2.5 sm:px-4 py-2 sm:py-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-element)] flex items-center justify-between">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Visit Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnarchive(b.id)}
                      className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1 font-bold"
                      title="Restore to Main Vault"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Unarchive</span>
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] p-1 rounded transition-colors"
                      title="Delete Permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
