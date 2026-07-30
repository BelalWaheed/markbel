import { SyncOutboxItem, SyncStorage, ConnectivityProvider, LifecycleProvider, ApiClient, RemoteChange, Unsubscribe } from './types';

export enum SyncState {
  Idle = 'Idle',
  Syncing = 'Syncing',
  Offline = 'Offline',
  Error = 'Error',
  Follower = 'Follower' // If another tab/instance is the leader
}

type SyncEventListener = (state: SyncState, details?: any) => void;

export class SyncManager {
  private storage: SyncStorage;
  private connectivity: ConnectivityProvider;
  private lifecycle: LifecycleProvider;
  private apiClient: ApiClient;

  private state: SyncState = SyncState.Idle;
  private listeners: SyncEventListener[] = [];
  private isSyncing: boolean = false;
  private protocolVersion: number = 1;
  private isLeader: boolean = false;
  private abortController: AbortController | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isPaused: boolean = false;
  
  private unsubOnline: Unsubscribe | null = null;
  private unsubForeground: Unsubscribe | null = null;
  private _releaseLock: (() => void) | null = null;

  // Metrics
  public metrics = {
    protocolVersion: 1,
    leaderHeartbeat: 0,
    retryCount: 0,
    conflictCount: 0,
    lastPushDurationMs: 0,
    lastPullDurationMs: 0,
    currentPollIntervalMs: 30000,
    lastError: null as string | null
  };

  constructor(config: { storage: SyncStorage, connectivity: ConnectivityProvider, lifecycle: LifecycleProvider, apiClient: ApiClient }) {
    this.storage = config.storage;
    this.connectivity = config.connectivity;
    this.lifecycle = config.lifecycle;
    this.apiClient = config.apiClient;
  }
  
  public get leaderStatus() {
    return this.isLeader;
  }

  public get currentState() {
    return this.state;
  }

  subscribe(listener: SyncEventListener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private setState(newState: SyncState, details?: any) {
    if (this.state === newState) return;
    this.state = newState;
    this.listeners.forEach(l => l(newState, details));
  }

  // -------------------------------------------------------------
  // Outbox Compaction
  // -------------------------------------------------------------
  private async compactOutbox(pending: SyncOutboxItem[]): Promise<SyncOutboxItem[]> {
    // Group by entityId
    const byEntity = new Map<string, SyncOutboxItem[]>();
    for (const item of pending) {
      if (!byEntity.has(item.entityId)) byEntity.set(item.entityId, []);
      byEntity.get(item.entityId)!.push(item);
    }

    const compacted: SyncOutboxItem[] = [];
    const toDeleteFromDb: string[] = [];

    for (const [entityId, ops] of byEntity.entries()) {
      ops.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      let finalOp: SyncOutboxItem | null = null;
      let createdInOffline = false;

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        
        if (!finalOp) {
          finalOp = op;
          if (op.operation === 'create') createdInOffline = true;
          continue;
        }

        // We already have a finalOp, let's merge `op` into it
        if (op.operation === 'delete') {
          if (createdInOffline) {
            // Create -> Delete = Both disappear
            toDeleteFromDb.push(finalOp.id, op.id);
            finalOp = null; 
            createdInOffline = false;
          } else {
            // Update -> Delete = Delete (keep baseVersion of the update)
            toDeleteFromDb.push(finalOp.id); // discard the previous update
            finalOp = { ...op, baseVersion: finalOp.baseVersion }; 
          }
        } else if (op.operation === 'update') {
          if (finalOp.operation === 'create' || finalOp.operation === 'update') {
            toDeleteFromDb.push(op.id); // we merge this into finalOp
            finalOp = {
              ...(finalOp as any),
              payload: { ...((finalOp.payload as any) || {}), ...((op.payload as any) || {}) },
              createdAt: op.createdAt
            } as SyncOutboxItem;
          } else if (finalOp.operation === 'delete') {
            // Delete -> Update = Invalid, but we can treat it as Restore (create)
            toDeleteFromDb.push(finalOp.id);
            finalOp = { ...op, operation: 'create', baseVersion: 0 };
            createdInOffline = true;
          }
        }
      }

      if (finalOp) {
        compacted.push(finalOp);
      }
    }

    // Cleanup local DB for redundant items
    if (toDeleteFromDb.length > 0) {
      await this.storage.removePendingChanges(toDeleteFromDb);
    }

    return compacted;
  }

  // -------------------------------------------------------------
  // Sync Engine
  // -------------------------------------------------------------
  async sync(isForce = false) {
    if (this.isPaused && !isForce) return;
    if (this.isSyncing || !this.isLeader) return;
    
    if (!(await this.connectivity.isOnline())) {
      this.setState(SyncState.Offline);
      return;
    }

    const token = await this.storage.getAuthToken();
    if (!token) return;

    this.isSyncing = true;
    this.setState(SyncState.Syncing);
    this.abortController = new AbortController();

    try {
      const deviceId = await this.storage.getDeviceId();
      if (!deviceId) throw new Error("Device ID not found");
      
      const pendingChanges = await this.storage.getPendingChanges(10000);
      
      const compactedBatch = await this.compactOutbox(pendingChanges);
      const pushBatch = compactedBatch.slice(0, 100);

      // --- PUSH PHASE ---
      if (pushBatch.length > 0) {
        const pushStart = performance.now();
        for (const item of pushBatch) {
          await this.storage.updatePendingChangeStatus(item.id, { status: 'processing', attempts: item.attempts + 1 });
        }

        const pushPayload = {
          protocolVersion: this.protocolVersion,
          deviceId,
          requestId: crypto.randomUUID(),
          changes: pushBatch.map(item => ({
            changeId: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            baseVersion: item.baseVersion,
            payload: item.payload
          }))
        };

        const result = await this.apiClient.post('/api/sync/push', pushPayload, { 'Authorization': `Bearer ${token}` }, this.abortController.signal);

        for (const resItem of result.results || []) {
          if (resItem.status === 'applied' || resItem.status === 'duplicate') {
            await this.storage.removePendingChanges([resItem.changeId]);
            if (resItem.status === 'applied') {
               await this.storage.applyRemoteChanges([{
                 changeId: resItem.changeId,
                 entityType: 'bookmark',
                 entityId: resItem.entityId,
                 operation: 'update',
                 version: resItem.version
               }]);
            }
          } else if (resItem.status === 'conflict') {
            this.metrics.conflictCount++;
            // Drop local change, server record will be pulled next step
            await this.storage.removePendingChanges([resItem.changeId]);
          } else {
            await this.storage.updatePendingChangeStatus(resItem.changeId, { status: 'failed', lastError: resItem.reason || 'Unknown error' });
          }
        }
        this.metrics.lastPushDurationMs = Math.round(performance.now() - pushStart);
      }

      // --- PULL PHASE ---
      let hasMore = true;
      const pullStart = performance.now();
      while (hasMore) {
        const cursor = await this.storage.getCursor();
        
        const pullData = await this.apiClient.get(`/api/sync/pull?entity=bookmark&cursor=${cursor}&limit=100`, { 'Authorization': `Bearer ${token}` }, this.abortController.signal);
        
        await this.storage.applyRemoteChanges(pullData.changes || []);
        await this.storage.saveCursor(pullData.nextCursor);

        hasMore = pullData.hasMore;
      }
      this.metrics.lastPullDurationMs = Math.round(performance.now() - pullStart);
      this.metrics.lastError = null;

      this.setState(SyncState.Idle);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Sync aborted');
      } else {
        console.error('Sync error:', err);
        await this.handleHttpError(err.status || 500);
        this.metrics.lastError = err.message;
        this.setState(SyncState.Error, err.message);
      }
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  // -------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------
  public pauseSync() {
    this.isPaused = true;
  }

  public resumeSync() {
    this.isPaused = false;
    this.sync();
  }

  public async resetCursor() {
    await this.storage.saveCursor(0);
  }

  public async registerDevice(platform: string, appVersion: string): Promise<void> {
    try {
      const token = await this.storage.getAuthToken();
      if (!token) return; // Cannot register if not logged in

      const deviceId = await this.storage.getDeviceId();
      if (!deviceId) return;

      const payload = {
        deviceId,
        platform,
        appVersion
      };

      await this.apiClient.post('/api/devices/register', payload, { 'Authorization': `Bearer ${token}` });
      console.log(`[SyncManager] Registered device ${deviceId} as ${platform} v${appVersion}`);
    } catch (err) {
      console.warn(`[SyncManager] Failed to register device:`, err);
    }
  }

  public async updatePushToken(pushToken: string): Promise<void> {
    try {
      const token = await this.storage.getAuthToken();
      if (!token) return; // Cannot update if not logged in

      const deviceId = await this.storage.getDeviceId();
      if (!deviceId) return;

      const payload = { pushToken };

      await this.apiClient.put(`/api/devices/${deviceId}/token`, payload, { 'Authorization': `Bearer ${token}` });
      console.log(`[SyncManager] Updated push token for device ${deviceId}`);
    } catch (err) {
      console.warn(`[SyncManager] Failed to update push token:`, err);
    }
  }

  private async handleHttpError(status: number) {
    switch (status) {
      case 400:
        console.warn('Sync rejected (400 Bad Request)');
        break;
      case 401:
        await this.storage.removeAuthToken();
        this.lifecycle.onAuthExpired();
        this.stop();
        break;
      case 403:
        console.warn('Sync stopped (403 Forbidden)');
        this.stop();
        break;
      case 404:
        console.warn('Sync 404 - pulling latest state');
        // Will be pulled in the next pull phase automatically
        break;
      case 409:
        // Handled directly inside the push loop
        break;
      case 429:
        console.warn('Rate limited (429)');
        // In a real implementation we would parse Retry-After header
        break;
      default:
        if (status >= 500) {
          console.warn(`Server error ${status} - will retry on exponential backoff`);
        }
        break;
    }
  }

  // -------------------------------------------------------------
  // Leader Election & Adaptive Polling
  // -------------------------------------------------------------
  private async scheduleNextSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (!this.isLeader) return;

    let interval = 30000; // 30s active
    if (!(await this.lifecycle.isForeground())) interval = 300000; // 5m hidden
    if (!(await this.connectivity.isOnline())) return; // Suspended until online
    if (this.isPaused) return;

    this.metrics.currentPollIntervalMs = interval;
    this.metrics.leaderHeartbeat = Date.now();

    this.syncTimer = setTimeout(() => {
      this.sync();
      this.scheduleNextSync();
    }, interval);
  }

  private handleOnline = (isOnline: boolean) => {
    if (isOnline && this.isLeader) {
      this.setState(SyncState.Idle);
      this.sync(); // immediate
      this.scheduleNextSync();
    } else if (!isOnline) {
      this.setState(SyncState.Offline);
    }
  }

  private handleVisibilityChange = () => {
    // Only run if we actually are foreground and leader
    this.lifecycle.isForeground().then(isForeground => {
      if (this.isLeader && isForeground) {
        this.connectivity.isOnline().then(isOnline => {
          if (isOnline) {
            this.sync(); // immediate sync when user returns to app
            this.scheduleNextSync();
          }
        });
      }
    });
  }

  public async startPeriodicSync() {
    if (!this.lifecycle.acquireLeaderLock) {
      console.warn("Leader lock API not provided. Running as leader fallback.");
      this.isLeader = true;
      this.initLeader();
      return;
    }

    // Try to acquire the SyncLeader lock.
    this.lifecycle.acquireLeaderLock('markbel-sync-leader', (release) => {
      return new Promise<void>((resolve) => {
        this.isLeader = true;
        this.initLeader();
        this._releaseLock = () => {
          resolve();
          release();
        };
      });
    }).catch(err => {
      console.error('Lock error', err);
    });

    // If we didn't become leader, state is Follower
    setTimeout(() => {
      if (!this.isLeader) {
        this.setState(SyncState.Follower);
      }
    }, 100);
  }

  private initLeader() {
    this.setState(SyncState.Idle);
    this.sync();
    this.scheduleNextSync();

    this.unsubOnline = this.connectivity.subscribe(this.handleOnline);
    this.unsubForeground = this.lifecycle.subscribeForeground(this.handleVisibilityChange);
  }

  public stop() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.abortController) this.abortController.abort();
    
    if (this.unsubOnline) this.unsubOnline();
    if (this.unsubForeground) this.unsubForeground();
    
    if (this.isLeader && this._releaseLock) {
      this._releaseLock();
    }
    this.isLeader = false;
  }
}
