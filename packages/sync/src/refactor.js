const fs = require('fs');

const path = 'B:/projects/bel_projects/markbel/markbel-vercel/packages/sync/src/SyncManager.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace imports
code = code.replace("import { db, SyncOutboxItem } from './db';", "import { SyncOutboxItem, SyncStorage, ConnectivityProvider, LifecycleProvider, ApiClient, RemoteChange } from './types';");
code = code.replace("import { bookmarkRepository } from './SyncRepository';", ""); // we don't have bookmarkRepository directly anymore! Wait! The repository applies remote changes!

// 2. Add constructor and fields
code = code.replace(
  'class SyncManager {',
  `class SyncManager {
  private storage: SyncStorage;
  private connectivity: ConnectivityProvider;
  private lifecycle: LifecycleProvider;
  private apiClient: ApiClient;

  constructor(config: { storage: SyncStorage, connectivity: ConnectivityProvider, lifecycle: LifecycleProvider, apiClient: ApiClient }) {
    this.storage = config.storage;
    this.connectivity = config.connectivity;
    this.lifecycle = config.lifecycle;
    this.apiClient = config.apiClient;
  }
`
);

// 3. Replace db calls with storage calls
code = code.replace(/await db\.appConfig\.get\('deviceId'\)/g, "await this.storage.getDeviceId()");
code = code.replace(/await db\.appConfig\.put\(\{ key: 'deviceId', value: newId \}\)/g, "await this.storage.saveDeviceId(newId)");

// compactOutbox cleanup
code = code.replace(/await db\.syncOutbox\.bulkDelete\(toDeleteFromDb\)/g, "await this.storage.removePendingChanges(toDeleteFromDb)");

// push phase
code = code.replace(/await db\.syncOutbox\.update\(item\.id, \{ status: 'processing', attempts: item\.attempts \+ 1 \}\)/g, "await this.storage.updatePendingChangeStatus(item.id, { status: 'processing', attempts: item.attempts + 1 })");
code = code.replace(/await db\.syncOutbox\.delete\(resItem\.changeId\)/g, "await this.storage.removePendingChanges([resItem.changeId])");
// For the bookmarks update, SyncManager shouldn't update bookmarks directly, but since we have `applyRemoteChanges` in SyncStorage:
code = code.replace(/const localItem = await db\.bookmarks\.get\(resItem\.entityId\);\s+if \(localItem\) await db\.bookmarks\.update\(resItem\.entityId, \{ version: resItem\.version \}\);/g, "await this.storage.applyRemoteChanges([{ changeId: resItem.changeId, entityType: 'bookmark', entityId: resItem.entityId, operation: 'update', version: resItem.version }])");
code = code.replace(/await db\.syncOutbox\.update\(resItem\.changeId, \{ status: 'failed', lastError: resItem\.reason \|\| 'Unknown error' \}\)/g, "await this.storage.updatePendingChangeStatus(resItem.changeId, { status: 'failed', lastError: resItem.reason || 'Unknown error' })");

// metadata cursor
code = code.replace(/const metadata = await db\.syncMetadata\.get\('bookmark-sync'\);\s+const cursor = metadata\?\.cursor \|\| 0;/g, "const cursor = await this.storage.getCursor();");
code = code.replace(/await db\.syncMetadata\.put\(\{\s+key: 'bookmark-sync',\s+cursor: pullData\.nextCursor,\s+lastSuccessfulSyncAt: new Date\(\)\.toISOString\(\),\s+protocolVersion: this\.protocolVersion\s+\}\);/g, "await this.storage.saveCursor(pullData.nextCursor);");
code = code.replace(/await db\.syncMetadata\.delete\('bookmark-sync'\);/g, "await this.storage.saveCursor(0);");

// pull phase - we apply remote changes via storage instead of bookmarkRepository
code = code.replace(/await bookmarkRepository\.getPendingChanges\(\)/g, "await this.storage.getPendingChanges(10000)");
code = code.replace(/for \(const change of pullData\.changes \|\| \[\]\) \{\s+await bookmarkRepository\.applyRemoteChange\(\s+change\.operation,\s+change\.version,\s+change\.record,\s+change\.deletedAt\s+\);\s+\}/g, "await this.storage.applyRemoteChanges(pullData.changes || []);");

// Environment adapters
code = code.replace(/!navigator\.onLine/g, "!(await this.connectivity.isOnline())");
code = code.replace(/document\.hidden/g, "!(await this.lifecycle.isForeground())"); // I need to add isForeground to lifecycle!
code = code.replace(/window\.dispatchEvent\(new Event\('auth-expired'\)\);/g, "this.lifecycle.onAuthExpired();");
code = code.replace(/localStorage\.getItem\('markbel_token'\) \|\| localStorage\.getItem\('token'\)/g, "await this.storage.getAuthToken()"); // I'll add this to SyncStorage
code = code.replace(/localStorage\.removeItem\('markbel_token'\);\s+localStorage\.removeItem\('token'\);/g, "await this.storage.removeAuthToken();");

// Replace fetch with apiClient
code = code.replace(/const pushRes = await fetch\('\/api\/sync\/push', \{\s+method: 'POST',\s+headers: \{ 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{token\}` \},\s+body: JSON\.stringify\(pushPayload\),\s+signal: this\.abortController\.signal\s+\}\);/g, "const pushRes = await this.apiClient.post('/api/sync/push', pushPayload, { Authorization: `Bearer \$\{token\}` }, this.abortController.signal);");
code = code.replace(/if \(!pushRes\.ok\) \{\s+await this\.handleHttpError\(pushRes\.status\);\s+throw new Error\(`Push request failed: \$\{pushRes\.status\}`\);\s+\}\s+const result = await pushRes\.json\(\);/g, "const result = pushRes.data;"); // assuming apiClient handles errors
code = code.replace(/const pullRes = await fetch\(`\/api\/sync\/pull\?entity=bookmark&cursor=\$\{cursor\}&limit=100`, \{\s+headers: \{ 'Authorization': `Bearer \$\{token\}` \},\s+signal: this\.abortController\.signal\s+\}\);/g, "const pullRes = await this.apiClient.get(`/api/sync/pull?entity=bookmark&cursor=\$\{cursor\}&limit=100`, { Authorization: `Bearer \$\{token\}` }, this.abortController.signal);");
code = code.replace(/if \(!pullRes\.ok\) \{\s+await this\.handleHttpError\(pullRes\.status\);\s+throw new Error\(`Pull request failed: \$\{pullRes\.status\}`\);\s+\}\s+const pullData = await pullRes\.json\(\);/g, "const pullData = pullRes.data;");

// Leader and bindings
code = code.replace(/window\.addEventListener\('online', this\.handleOnline\);/g, "this.unsubOnline = this.connectivity.subscribe(this.handleOnline);");
code = code.replace(/window\.addEventListener\('offline', \(\) => this\.setState\(SyncState\.Offline\)\);/g, "/* handled in handleOnline */");
code = code.replace(/document\.addEventListener\('visibilitychange', this\.handleVisibilityChange\);/g, "this.unsubForeground = this.lifecycle.subscribeForeground(this.handleVisibilityChange);");

code = code.replace(/window\.removeEventListener\('online', this\.handleOnline\);/g, "if (this.unsubOnline) this.unsubOnline();");
code = code.replace(/window\.removeEventListener\('offline', \(\) => this\.setState\(SyncState\.Offline\)\);/g, "");
code = code.replace(/document\.removeEventListener\('visibilitychange', this\.handleVisibilityChange\);/g, "if (this.unsubForeground) this.unsubForeground();");

code = code.replace(/if \(!\('locks' in navigator\)\) \{/g, "if (!this.lifecycle.acquireLeaderLock) {");
code = code.replace(/navigator\.locks\.request\('markbel-sync-leader', \(lock\) => \{/g, "this.lifecycle.acquireLeaderLock('markbel-sync-leader', () => {");

code = code.replace(/export const syncManager = new SyncManager\(\);/g, ""); // Remove singleton export, the apps should initialize it

fs.writeFileSync(path, code);
