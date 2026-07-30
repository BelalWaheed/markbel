import React, { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { initDb } from './src/db/db';
import { syncManager, SyncState } from './src/db/SyncManager';
import { bookmarkRepository, Bookmark } from './src/db/SyncRepository';
import * as SQLite from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { initializeNotifications } from './src/notifications/init';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[BackgroundFetch] Running background sync...');
    await initDb();
    await syncManager.sync();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[BackgroundFetch] Failed to sync:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(SyncState.Idle);
  
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isScrapingMeta, setIsScrapingMeta] = useState(false);
  const deepLink = Linking.useURL();

  // Handle TickTick Deep Link
  useEffect(() => {
    if (deepLink && deepLink.includes('ticktick=connected')) {
      alert('TickTick Connected Successfully!');
      syncManager.sync(true); // Sync to get the new token status
    }
  }, [deepLink]);

  // Auto-fetch metadata
  useEffect(() => {
    if (!url.trim() || title.trim()) return;
    const handler = setTimeout(async () => {
      setIsScrapingMeta(true);
      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL}/api/metadata` : 'http://10.0.2.2:3001/api/metadata';
        const res = await fetch(`${apiUrl}?url=${encodeURIComponent(url.trim())}`);
        const meta = await res.json();
        if (meta && meta.title && !title) {
          setTitle(meta.title);
        }
      } catch (e) {
        console.warn('Scraper failed:', e);
      } finally {
        setIsScrapingMeta(false);
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [url, title]);

  useEffect(() => {
    async function setup() {
      await initDb();
      setDbInitialized(true);
      
      await initializeNotifications();

      await syncManager.registerDevice('mobile', '1.0.0');

      syncManager.startPeriodicSync();
      syncManager.subscribe(state => setSyncState(state));

      // Register Background Fetch
      BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      }).catch(console.error);
    }
    setup();
  }, []);

  useEffect(() => {
    if (!dbInitialized) return;
    const db = SQLite.openDatabaseSync('markbel.db');
    
    // Quick polling to keep UI updated for this demo
    const interval = setInterval(async () => {
      const rows = await db.getAllAsync(`SELECT * FROM bookmarks WHERE deletedAt IS NULL ORDER BY createdAt DESC`) as Bookmark[];
      setBookmarks(rows.map(r => ({ ...r, tags: JSON.parse(r.tags as any) })));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [dbInitialized]);

  const handleAdd = async () => {
    if (!url || !title) return;
    await bookmarkRepository.create({
      id: crypto.randomUUID(),
      url,
      title,
      tags: [],
      description: ''
    });
    setUrl('');
    setTitle('');
    syncManager.sync(); // Trigger immediate sync
  };

  const handleDelete = async (id: string) => {
    await bookmarkRepository.delete(id);
    syncManager.sync();
  };

  if (!dbInitialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0efea" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Markbel Native</Text>
        <Text style={styles.syncStatus}>Sync: {syncState}</Text>
      </View>

      <View style={styles.form}>
        <TextInput style={styles.input} placeholder={isScrapingMeta ? "Fetching title..." : "Title"} value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="URL" value={url} onChangeText={setUrl} autoCapitalize="none" />
        <TouchableOpacity style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Add Bookmark (Offline-First)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncButton} onPress={() => syncManager.sync(true)}>
          <Text style={styles.buttonText}>Force Sync</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={bookmarks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardUrl}>{item.url}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0efea' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  syncStatus: { fontSize: 14, color: '#4b5563', fontWeight: 'bold' },
  form: { padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: '#f9fafb' },
  button: { backgroundColor: '#4f46e5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  syncButton: { backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  card: { padding: 16, marginHorizontal: 20, marginTop: 16, backgroundColor: 'white', borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardUrl: { fontSize: 13, color: '#6b7280' },
  deleteButton: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 6 },
  deleteButtonText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12 }
});
