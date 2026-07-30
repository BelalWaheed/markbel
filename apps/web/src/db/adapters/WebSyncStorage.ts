import { db } from '../db';
import { SyncStorage, SyncOutboxItem, RemoteChange } from '@markbel/sync';

export class WebSyncStorage implements SyncStorage {
  async getPendingChanges(limit: number): Promise<SyncOutboxItem[]> {
    const pending = await db.syncOutbox
      .filter(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
    return pending.slice(0, limit);
  }

  async savePendingChange(change: SyncOutboxItem): Promise<void> {
    await db.syncOutbox.put(change);
  }

  async updatePendingChangeStatus(id: string, updates: Partial<SyncOutboxItem>): Promise<void> {
    await db.syncOutbox.update(id, updates as any);
  }

  async removePendingChanges(ids: string[]): Promise<void> {
    await db.syncOutbox.bulkDelete(ids);
  }

  async getCursor(): Promise<number> {
    const metadata = await db.syncMetadata.get('bookmark-sync');
    return metadata?.cursor || 0;
  }

  async saveCursor(cursor: number): Promise<void> {
    await db.syncMetadata.put({
      key: 'bookmark-sync',
      cursor,
      lastSuccessfulSyncAt: new Date().toISOString(),
      protocolVersion: 1
    });
  }

  async getDeviceId(): Promise<string | undefined> {
    const existing = await db.appConfig.get('deviceId');
    if (existing) return existing.value;
    
    const newId = `browser-${crypto.randomUUID()}`;
    await db.appConfig.put({ key: 'deviceId', value: newId });
    return newId;
  }

  async saveDeviceId(deviceId: string): Promise<void> {
    await db.appConfig.put({ key: 'deviceId', value: deviceId });
  }

  async getAuthToken(): Promise<string | null> {
    return 'cookie';
  }

  async removeAuthToken(): Promise<void> {
    localStorage.removeItem('markbel_token');
    localStorage.removeItem('token');
  }

  async applyRemoteChanges(changes: RemoteChange[]): Promise<void> {
    await db.transaction('rw', db.bookmarks, async () => {
      for (const change of changes) {
        if (change.operation === 'delete') {
          const localItem = await db.bookmarks.get(change.entityId);
          if (localItem) {
            await db.bookmarks.update(change.entityId, { 
              deletedAt: change.deletedAt || new Date().toISOString(),
              version: change.version 
            });
          }
        } else if (change.operation === 'create' || change.operation === 'update') {
          if (!change.payload) continue;
          const localItem = await db.bookmarks.get(change.entityId);
          if (localItem) {
            // Update
            await db.bookmarks.update(change.entityId, {
              ...change.payload,
              version: change.version,
              updatedAt: new Date().toISOString()
            });
          } else {
            // Create
            await db.bookmarks.put({
              ...change.payload,
              id: change.entityId,
              version: change.version,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null
            });
          }
        }
      }
    });
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return await db.transaction('rw', db.bookmarks, db.syncOutbox, db.syncMetadata, db.appConfig, callback);
  }
}
