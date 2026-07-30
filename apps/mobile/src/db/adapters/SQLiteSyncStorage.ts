import * as SQLite from 'expo-sqlite';
import { SyncStorage, SyncOutboxItem, RemoteChange } from '@markbel/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

// Get or open the local SQLite database
function getDb() {
  return SQLite.openDatabaseSync('markbel.db');
}

export class SQLiteSyncStorage implements SyncStorage {
  async getPendingChanges(limit: number): Promise<SyncOutboxItem[]> {
    const db = getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM sync_outbox WHERE status IN ('pending', 'failed') ORDER BY createdAt ASC LIMIT ?`, 
      [limit]
    );
    
    return rows.map((r: any) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : undefined
    }));
  }

  async savePendingChange(change: SyncOutboxItem): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_outbox (id, entityType, entityId, operation, baseVersion, payload, status, attempts, lastError, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        change.id,
        change.entityType,
        change.entityId,
        change.operation,
        change.baseVersion,
        change.payload ? JSON.stringify(change.payload) : null,
        change.status,
        change.attempts,
        change.lastError || null,
        change.createdAt
      ]
    );
  }

  async updatePendingChangeStatus(id: string, updates: Partial<SyncOutboxItem>): Promise<void> {
    const db = getDb();
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [k, v] of Object.entries(updates)) {
      sets.push(`${k} = ?`);
      values.push(v);
    }
    
    if (sets.length === 0) return;
    
    values.push(id);
    await db.runAsync(`UPDATE sync_outbox SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  async removePendingChanges(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM sync_outbox WHERE id IN (${placeholders})`, ids);
  }

  async getCursor(): Promise<number> {
    const db = getDb();
    const row = await db.getFirstAsync(`SELECT cursor FROM sync_metadata WHERE key = 'bookmark-sync'`) as any;
    return row?.cursor || 0;
  }

  async saveCursor(cursor: number): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, cursor, lastSuccessfulSyncAt, protocolVersion) VALUES (?, ?, ?, ?)`,
      ['bookmark-sync', cursor, new Date().toISOString(), 1]
    );
  }

  async getDeviceId(): Promise<string | undefined> {
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id = `mobile-${randomUUID()}`;
      await AsyncStorage.setItem('deviceId', id);
    }
    return id;
  }

  async saveDeviceId(deviceId: string): Promise<void> {
    await AsyncStorage.setItem('deviceId', deviceId);
  }

  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem('markbel_token');
  }

  async removeAuthToken(): Promise<void> {
    await AsyncStorage.removeItem('markbel_token');
  }

  async applyRemoteChanges(changes: RemoteChange[]): Promise<void> {
    const db = getDb();
    await db.withTransactionAsync(async () => {
      for (const change of changes) {
        if (change.operation === 'delete') {
          await db.runAsync(
            `UPDATE bookmarks SET deletedAt = ?, version = ? WHERE id = ?`,
            [change.deletedAt || new Date().toISOString(), change.version, change.entityId]
          );
        } else if (change.operation === 'create' || change.operation === 'update') {
          if (!change.payload) continue;
          
          const existing = await db.getFirstAsync(`SELECT id FROM bookmarks WHERE id = ?`, [change.entityId]);
          if (existing) {
            // Update
            const sets = Object.keys(change.payload).map(k => `${k} = ?`);
            const vals = Object.values(change.payload);
            
            await db.runAsync(
              `UPDATE bookmarks SET ${sets.join(', ')}, version = ?, updatedAt = ? WHERE id = ?`,
              [...vals, change.version, new Date().toISOString(), change.entityId] as any
            );
          } else {
            // Create
            const keys = Object.keys(change.payload);
            const vals = Object.values(change.payload);
            const placeholders = keys.map(() => '?');
            
            await db.runAsync(
              `INSERT INTO bookmarks (id, version, createdAt, updatedAt, deletedAt, ${keys.join(', ')}) 
               VALUES (?, ?, ?, ?, NULL, ${placeholders.join(', ')})`,
              [change.entityId, change.version, new Date().toISOString(), new Date().toISOString(), ...vals] as any
            );
          }
        }
      }
    });
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const db = getDb();
    let result: T;
    await db.withTransactionAsync(async () => {
      result = await callback();
    });
    return result!;
  }
}
