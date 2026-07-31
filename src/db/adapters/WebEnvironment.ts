import { ConnectivityProvider, LifecycleProvider, Unsubscribe } from '@/sync';

export class WebEnvironment implements ConnectivityProvider, LifecycleProvider {
  // ConnectivityProvider
  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  subscribe(callback: (isOnline: boolean) => void): Unsubscribe {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }

  // LifecycleProvider
  subscribeForeground(callback: () => void): Unsubscribe {
    const handler = () => {
      if (!document.hidden) {
        callback();
      }
    };
    
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
  }

  async isForeground(): Promise<boolean> {
    return !document.hidden;
  }

  onAuthExpired(): void {
    window.dispatchEvent(new Event('auth-expired'));
  }

  async acquireLeaderLock(lockName: string, acquire: (release: () => void) => Promise<void>): Promise<void> {
    if (!('locks' in navigator)) {
      throw new Error('Web Locks API not supported');
    }
    
    await navigator.locks.request(lockName, (lock) => {
      return new Promise<void>((resolve) => {
        acquire(() => resolve());
      });
    });
  }
}
