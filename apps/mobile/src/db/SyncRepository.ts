import * as SQLite from 'expo-sqlite';
import { SyncOutboxItem as SharedSyncOutboxItem } from '@markbel/sync';
import { randomUUID } from 'expo-crypto';

function getDb() {
  return SQLite.openDatabaseSync('markbel.db');
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags: string[];
  group?: string;
  image?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncRepository<T> {
  create(entity: Omit<T, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<void>;
  
  getPendingChanges(): Promise<SharedSyncOutboxItem[]>;
  applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<T>, deletedAt?: string | null): Promise<void>;
}

export const bookmarkRepository: SyncRepository<Bookmark> = {
  async create(data) {
    const db = getDb();
    const id = (data as any).id || randomUUID();
    const now = new Date().toISOString();
    
    const bookmark: Bookmark = {
      ...data,
      id,
      tags: data.tags || [],
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    const outboxId = randomUUID();
    
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO bookmarks (id, url, title, description, tags, "group", image, version, createdAt, updatedAt, deletedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookmark.id, bookmark.url, bookmark.title, bookmark.description || null, JSON.stringify(bookmark.tags), bookmark.group || null, bookmark.image || null, bookmark.version, bookmark.createdAt, bookmark.updatedAt, bookmark.deletedAt]
      );
      
      await db.runAsync(
        `INSERT INTO sync_outbox (id, entityType, entityId, operation, baseVersion, payload, status, attempts, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [outboxId, 'bookmark', bookmark.id, 'create', bookmark.version, JSON.stringify(data), 'pending', 0, now]
      );
    });

    return bookmark;
  },

  async update(id, updates) {
    const db = getDb();
    const now = new Date().toISOString();
    let updatedBookmark: Bookmark | undefined;

    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync(`SELECT * FROM bookmarks WHERE id = ?`, [id]) as any;
      if (!existing) return;

      const newVersion = existing.version + 1;
      
      const payload: any = { ...updates };
      
      const sets = Object.keys(updates).map(k => `"${k}" = ?`);
      const vals = Object.values(updates).map(v => {
          if (Array.isArray(v)) return JSON.stringify(v);
          return v;
      });
      
      await db.runAsync(
        `UPDATE bookmarks SET ${sets.join(', ')}, version = ?, updatedAt = ? WHERE id = ?`,
        [...vals, newVersion, now, id]
      );

      const outboxId = randomUUID();
      await db.runAsync(
        `INSERT INTO sync_outbox (id, entityType, entityId, operation, baseVersion, payload, status, attempts, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [outboxId, 'bookmark', id, 'update', existing.version, JSON.stringify(payload), 'pending', 0, now]
      );

      updatedBookmark = {
          ...existing,
          ...updates,
          tags: Array.isArray(updates.tags) ? updates.tags : (existing.tags ? JSON.parse(existing.tags) : []),
          version: newVersion,
          updatedAt: now
      };
    });

    return updatedBookmark;
  },

  async delete(id) {
    const db = getDb();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync(`SELECT version FROM bookmarks WHERE id = ?`, [id]) as any;
      if (!existing) return;

      const newVersion = existing.version + 1;
      
      await db.runAsync(
        `UPDATE bookmarks SET deletedAt = ?, version = ?, updatedAt = ? WHERE id = ?`,
        [now, newVersion, now, id]
      );

      const outboxId = randomUUID();
      await db.runAsync(
        `INSERT INTO sync_outbox (id, entityType, entityId, operation, baseVersion, payload, status, attempts, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [outboxId, 'bookmark', id, 'delete', existing.version, null, 'pending', 0, now]
      );
    });
  },

  async getPendingChanges(): Promise<SharedSyncOutboxItem[]> {
    const db = getDb();
    const rows = await db.getAllAsync(`SELECT * FROM sync_outbox WHERE status IN ('pending', 'failed') ORDER BY createdAt ASC`);
    return rows.map((r: any) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : undefined
    }));
  },

  async applyRemoteChange(operation, version, record, deletedAt) {
    // Deprecated for the new SyncManager!
  }
};
