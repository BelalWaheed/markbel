import * as SQLite from 'expo-sqlite';

export async function initDb() {
  const db = SQLite.openDatabaseSync('markbel.db');
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL,
      "group" TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      remindAt TEXT
    );
    
    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      bookmarkId TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      triggerAtUtc TEXT NOT NULL,
      state TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      operation TEXT NOT NULL,
      baseVersion INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      createdAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      cursor INTEGER NOT NULL DEFAULT 0,
      lastSuccessfulSyncAt TEXT,
      protocolVersion INTEGER NOT NULL DEFAULT 1
    );
  `);

  try {
    // Attempt to add "group" column if it doesn't exist (for existing dev DBs)
    await db.execAsync(`ALTER TABLE bookmarks ADD COLUMN "group" TEXT;`);
  } catch (e) {
    // Ignore error if column already exists
  }
}
