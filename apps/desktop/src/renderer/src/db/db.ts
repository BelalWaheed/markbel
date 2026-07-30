import Dexie, { Table } from 'dexie';

export interface LocalBookmark {
  id: string;
  userId: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  group: string;
  isRead?: boolean;
  readAt?: string;
  isPinned?: boolean;
  remindAt?: string;
  isArchived?: boolean;
  archiveGroup?: string;
  ticktickTaskId?: string;
  ticktickProjectId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncOutboxItem {
  id: string; // crypto.randomUUID()
  entityType: string; // 'bookmark'
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  baseVersion: number;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export interface SyncMetadata {
  key: string; // 'bookmark-sync'
  cursor: number | null;
  lastSuccessfulSyncAt: string | null;
  protocolVersion: number; // For future api versioning
}

export interface AppConfig {
  key: string;
  value: any;
}

export class MarkbelDatabase extends Dexie {
  bookmarks!: Table<LocalBookmark, string>;
  syncOutbox!: Table<SyncOutboxItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  appConfig!: Table<AppConfig, string>; // Store deviceId etc here

  scheduledNotifications!: Table<any, string>;

  constructor() {
    super('MarkbelDatabase');
    
    // Define tables and indexes
    this.version(1).stores({
      bookmarks: 'id, userId, group, isArchived, isRead, deletedAt', 
      syncOutbox: 'id, entityType, entityId, status, createdAt',
      syncMetadata: 'key',
      appConfig: 'key'
    });

    this.version(2).stores({
      scheduledNotifications: 'id, bookmarkId, triggerAtUtc'
    }).upgrade(() => {});
  }
}

export const db = new MarkbelDatabase();
