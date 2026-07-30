# Platform Adapters & Dependency Injection

The Markbel engine relies heavily on dependency injection (DI) to separate the business logic of syncing from the specifics of the runtime environment. These abstractions ensure the core `@markbel/sync` package remains framework-agnostic.

## ConnectivityProvider

Monitors real-time network conditions.

```typescript
export interface ConnectivityProvider {
  isOnline(): Promise<boolean>;
  subscribe(callback: (isOnline: boolean) => void): Unsubscribe;
}
```

- **Web Adapter (`WebEnvironment`)**: Uses `navigator.onLine` and `window.addEventListener('online' | 'offline')`.
- **Mobile Adapter (`MobileEnvironment`)**: Uses `expo-network.getNetworkStateAsync()`.
- **Desktop Adapter (`ElectronEnvironment`)**: Uses `navigator.onLine` combined with IPC network events from the OS if needed.

## LifecycleProvider

Determines if the application is active and provides locking mechanics for Leader Election.

```typescript
export interface LifecycleProvider {
  subscribeForeground(callback: () => void): Unsubscribe;
  isForeground(): Promise<boolean>;
  onAuthExpired(): void;
  acquireLeaderLock?: (lockName: string, acquire: (release: () => void) => Promise<void>) => Promise<void>;
}
```

- **Web Adapter**: 
  - `isForeground`: `document.visibilityState === 'visible'`
  - `subscribeForeground`: Listens to `visibilitychange`
  - `acquireLeaderLock`: Implements `navigator.locks.request` to ensure only 1 browser tab synchronizes.
- **Mobile Adapter**: 
  - `isForeground`: React Native `AppState.currentState === 'active'`
  - `acquireLeaderLock`: No-op (Mobile is a single-window OS environment).
- **Desktop Adapter**: 
  - Integrates `electron` `powerMonitor` and window focus events.
  - `acquireLeaderLock`: Uses `app.requestSingleInstanceLock()` to prevent multiple Electron windows from fighting over SQLite connections.

## ApiClient

The HTTP fetcher wrapper to bypass environment-specific Fetch behaviors.

```typescript
export interface ApiClient {
  get(endpoint: string, headers?: any, signal?: AbortSignal): Promise<any>;
  post(endpoint: string, data: any, headers?: any, signal?: AbortSignal): Promise<any>;
}
```

This simple interface injects Authorization headers, handles base URL prepending (since React Native needs absolute URLs, while Vite Web uses relative `/api` proxies), and normalizes error throwing logic.
