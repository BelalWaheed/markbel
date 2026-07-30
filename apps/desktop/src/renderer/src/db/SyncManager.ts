import { SyncManager, SyncState, ApiClient } from '@markbel/sync';
import { WebSyncStorage } from './adapters/WebSyncStorage';
import { WebEnvironment } from './adapters/WebEnvironment';

const storage = new WebSyncStorage();
const env = new WebEnvironment();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
