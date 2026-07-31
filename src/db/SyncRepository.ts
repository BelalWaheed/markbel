import { db, LocalBookmark, LocalGroup, SyncOutboxItem } from './db';
import { SyncOutboxItem as SharedSyncOutboxItem } from '@/sync';

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

export class GroupRepository implements SyncRepository<LocalGroup> {
  async create(data: Omit<LocalGroup, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<LocalGroup> {
    const now = new Date().toISOString();
    
    const group: LocalGroup = {
      ...data,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    await db.transaction('rw', db.groups, db.syncOutbox, async () => {
      await db.groups.add(group);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
        entityId: group.id,
        operation: 'create',
        baseVersion: group.version,
        payload: group,
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    return group;
  }

  async update(id: string, updates: Partial<LocalGroup>): Promise<LocalGroup | undefined> {
    const now = new Date().toISOString();
    let updatedGroup: LocalGroup | undefined;

    await db.transaction('rw', db.groups, db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.groups.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      updatedGroup = {
        ...existing,
        ...updates,
        updatedAt: now
      };
      
      await db.groups.put(updatedGroup);
      
      if (updates.name && existing.name !== updates.name) {
        // Bulk update local bookmarks
        const affectedBookmarks = await db.bookmarks
          .filter(b => b.group === existing.name)
          .toArray();
        for (const b of affectedBookmarks) {
          b.group = updates.name;
          b.updatedAt = now;
          await db.bookmarks.put(b);
        }
      }
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
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

    return updatedGroup;
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', db.groups, db.syncOutbox, async () => {
      const existing = await db.groups.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      const updatedGroup = {
        ...existing,
        updatedAt: now,
        deletedAt: now
      };
      
      await db.groups.put(updatedGroup);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
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
      .where('entityType').equals('group')
      .and(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
  }

  async applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<LocalGroup>, deletedAt?: string | null): Promise<void> {
    if (!record || !record.id) return;
    
    await db.transaction('rw', db.groups, async () => {
      const existing = await db.groups.get(record.id!);
      
      if (operation === 'create' || operation === 'update') {
        await db.groups.put({
          ...(existing || {}),
          ...record,
          version
        } as LocalGroup);
      } else if (operation === 'delete') {
        if (existing) {
          existing.deletedAt = deletedAt || new Date().toISOString();
          existing.version = version;
          await db.groups.put(existing);
        }
      }
    });
  }
}

export const groupRepository = new GroupRepository();
