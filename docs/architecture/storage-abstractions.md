# Storage Abstractions

The Markbel engine relies heavily on the `SyncStorage` interface to abstract away the underlying database mechanisms (Dexie/IndexedDB for Web, Expo SQLite for Mobile, Better SQLite3 for Desktop).

## SyncStorage Interface

The required methods govern Outbox mutation queues, Cursor tracking, and applying Remote Changes locally.

```typescript
export interface SyncStorage {
  // Outbox Management
  getPendingChanges(limit: number): Promise<SyncOutboxItem[]>;
  savePendingChange(change: SyncOutboxItem): Promise<void>;
  updatePendingChangeStatus(id: string, updates: Partial<SyncOutboxItem>): Promise<void>;
  removePendingChanges(ids: string[]): Promise<void>;
  
  // Metadata Tracking
  getCursor(): Promise<number>;
  saveCursor(cursor: number): Promise<void>;
  getDeviceId(): Promise<string | undefined>;
  saveDeviceId(deviceId: string): Promise<void>;
  getAuthToken(): Promise<string | null>;
  removeAuthToken(): Promise<void>;
  
  // Downstream application
  applyRemoteChanges(changes: RemoteChange[]): Promise<void>;
  
  // Concurrency
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}
```

## Outbox Pattern

Rather than interacting with the Sync Engine directly, User Interface components modify local entities (e.g., Bookmarks) *and simultaneously insert a record into the `sync_outbox` table* within the exact same database transaction.

This guarantees absolute consistency. If the app crashes immediately after a user adds a bookmark, the outbox record is already saved, and the Sync Manager will eventually push it once restored.

### Outbox Compaction
Once the Sync Manager successfully pushes an outbox record to the backend and receives a `status: 'success'` response, it immediately executes `removePendingChanges([id])`.

## applyRemoteChanges

The storage adapter is responsible for interpreting `RemoteChange` items from the Pull Phase and atomically merging them into local tables. It must parse the `operation` (`create`, `update`, `delete`) and apply it using upsert semantics against the local entity.
