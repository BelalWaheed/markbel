export interface SyncChange {
  sequence: number;
  userId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  entityVersion: number;
  payload: any;
  createdAt: string;
}

export interface SyncOutboxItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  baseVersion: number;
  payload: any;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export interface RemoteChange {
  changeId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  version: number;
  payload?: any;
  deletedAt?: string | null;
  reason?: string; // For conflict resolution (rejected)
}

export interface SyncStorage {
  getPendingChanges(limit: number): Promise<SyncOutboxItem[]>;
  savePendingChange(change: SyncOutboxItem): Promise<void>;
  updatePendingChangeStatus(id: string, updates: Partial<SyncOutboxItem>): Promise<void>;
  removePendingChanges(ids: string[]): Promise<void>;
  
  getCursor(): Promise<number>;
  saveCursor(cursor: number): Promise<void>;
  
  getDeviceId(): Promise<string | undefined>;
  saveDeviceId(deviceId: string): Promise<void>;
  getAuthToken(): Promise<string | null>;
  removeAuthToken(): Promise<void>;
  
  applyRemoteChanges(changes: RemoteChange[]): Promise<void>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

export type Unsubscribe = () => void;

export interface ConnectivityProvider {
  isOnline(): Promise<boolean>;
  subscribe(callback: (isOnline: boolean) => void): Unsubscribe;
}

export interface LifecycleProvider {
  subscribeForeground(callback: () => void): Unsubscribe;
  isForeground(): Promise<boolean>;
  onAuthExpired(): void;
  acquireLeaderLock?: (lockName: string, acquire: (release: () => void) => Promise<void>) => Promise<void>;
}

export interface ApiClient {
  get(endpoint: string, headers?: any, signal?: AbortSignal): Promise<any>;
  post(endpoint: string, data: any, headers?: any, signal?: AbortSignal): Promise<any>;
  put(endpoint: string, data: any, headers?: any, signal?: AbortSignal): Promise<any>;
}
