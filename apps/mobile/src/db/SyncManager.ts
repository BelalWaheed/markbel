import { SyncManager, SyncState, ApiClient } from '@markbel/sync';
import { SQLiteSyncStorage } from './adapters/SQLiteSyncStorage';
import { MobileEnvironment } from './adapters/MobileEnvironment';

const storage = new SQLiteSyncStorage();
const env = new MobileEnvironment();

// We need an absolute URL for the API since React Native doesn't run in a browser with a relative origin
const API_BASE_URL = 'http://10.0.2.2:3000'; // Default Android emulator host for localhost

const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers, signal });
    if (!res.ok) {
      const err: any = new Error(`Pull request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  post: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
      signal
    });
    if (!res.ok) {
      const err: any = new Error(`Push request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  put: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
      signal
    });
    if (!res.ok) {
      const err: any = new Error(`Put request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }
};

export const syncManager = new SyncManager({
  storage,
  connectivity: env,
  lifecycle: env,
  apiClient
});

export { SyncState };
