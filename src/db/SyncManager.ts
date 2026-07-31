import { SyncManager, SyncState, ApiClient } from '@/sync';
import { WebSyncStorage } from './adapters/WebSyncStorage';
import { WebEnvironment } from './adapters/WebEnvironment';

const storage = new WebSyncStorage();
const env = new WebEnvironment();

const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(endpoint, { headers, signal, credentials: 'include' });
    if (!res.ok) {
      const err: any = new Error(`Pull request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  post: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
      signal,
      credentials: 'include'
    });
    if (!res.ok) {
      const err: any = new Error(`Push request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  put: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
      signal,
      credentials: 'include'
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
