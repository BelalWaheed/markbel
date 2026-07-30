import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { ConnectivityProvider, LifecycleProvider, Unsubscribe } from '@markbel/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class MobileEnvironment implements ConnectivityProvider, LifecycleProvider {
  // ConnectivityProvider
  async isOnline(): Promise<boolean> {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  }

  subscribe(callback: (isOnline: boolean) => void): Unsubscribe {
    // expo-network doesn't have an event listener, but NetInfo from react-native-community does.
    // As a simple fallback without bringing in NetInfo, we could poll, but let's just 
    // rely on AppState and manual refresh if NetInfo isn't available.
    // If we had @react-native-community/netinfo we would do:
    // return NetInfo.addEventListener(state => callback(state.isConnected));
    
    // For now, we will return a no-op unsubscribe, and rely on foregrounding to trigger sync
    return () => {};
  }

  // LifecycleProvider
  subscribeForeground(callback: () => void): Unsubscribe {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        callback();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }

  async isForeground(): Promise<boolean> {
    return AppState.currentState === 'active';
  }

  onAuthExpired(): void {
    // Instead of window.dispatchEvent, we could use an EventEmitter or just handle it at UI level
    // In React Native, usually you clear AsyncStorage and navigate to login
    AsyncStorage.removeItem('markbel_token');
  }

  // Mobile apps are single-process, so leader lock is implicitly acquired instantly
  async acquireLeaderLock(lockName: string, acquire: (release: () => void) => Promise<void>): Promise<void> {
    await acquire(() => {
      // no-op release since we never release until the app dies
    });
  }
}
