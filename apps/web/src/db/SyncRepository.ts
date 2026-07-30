import { db, LocalBookmark, SyncOutboxItem } from './db';
import { SyncOutboxItem as SharedSyncOutboxItem } from '@markbel/sync';

export interface SyncRepository<T> {
  create(entity: Omit<T, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<void>;
  
  getPendingChanges(): Promise<SharedSyncOutboxItem[]>;
  applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<T>, deletedAt?: string | null): Promise<void>;
}

export class BookmarkRepository implements SyncRepository<LocalBookmark> {
  async create(data: Omit<LocalBookmark, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<LocalBookmark> {
    const now = new Date().toISOString();
    
    const bookmark: LocalBookmark = {
      ...data,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      await db.bookmarks.add(bookmark);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: bookmark.id,
        operation: 'create',
        baseVersion: bookmark.version,
        payload: bookmark,
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    return bookmark;
  }

  async update(id: string, updates: Partial<LocalBookmark>): Promise<LocalBookmark | undefined> {
    const now = new Date().toISOString();
    let updatedBookmark: LocalBookmark | undefined;

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.bookmarks.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; // Don't update deleted items

      updatedBookmark = {
        ...existing,
        ...updates,
        updatedAt: now
      };
      
      // Update local db, but keep version same until sync confirms
      await db.bookmarks.put(updatedBookmark);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        operation: 'update',
        baseVersion: existing.version,
        payload: { ...updates, updatedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    return updatedBookmark;
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.bookmarks.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      const updatedBookmark = {
        ...existing,
        updatedAt: now,
        deletedAt: now
      };
      
      await db.bookmarks.put(updatedBookmark);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        operation: 'delete',
        baseVersion: existing.version,
        payload: { deletedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });
  }

  async getPendingChanges(): Promise<SyncOutboxItem[]> {
    return await db.syncOutbox
      .where('entityType').equals('bookmark')
      .and(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
  }

  async applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<LocalBookmark>, deletedAt?: string | null): Promise<void> {
    if (!record || !record.id) return;
    
    await db.transaction('rw', db.bookmarks, async () => {
      const existing = await db.bookmarks.get(record.id!);
      
      if (operation === 'create' || operation === 'update') {
        // If we have a local version that is newer, we might have a conflict, but since server is source of truth,
        // we overwrite with server version. The SyncManager handles conflict resolution by rejecting local pushes.
        await db.bookmarks.put({
          ...(existing || {}),
          ...record,
          version
        } as LocalBookmark);
      } else if (operation === 'delete') {
        if (existing) {
          existing.deletedAt = deletedAt || new Date().toISOString();
          existing.version = version;
          await db.bookmarks.put(existing);
        }
      }
    });
  }
}

export const bookmarkRepository = new BookmarkRepository();
