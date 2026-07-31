import React, { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
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
  const [description, setDescription] = useState('');
  const [group, setGroup] = useState('');
  
  const [isScrapingMeta, setIsScrapingMeta] = useState(false);
  const [fetchedMeta, setFetchedMeta] = useState<{ title: string; description: string; image: string } | null>(null);
  const deepLink = Linking.useURL();

  // Handle TickTick Deep Link
  useEffect(() => {
    if (deepLink && deepLink.includes('ticktick=connected')) {
      alert('TickTick Connected Successfully!');
      syncManager.sync(true);
    }
  }, [deepLink]);

  // Background Fetch metadata
  useEffect(() => {
    if (!url.trim()) return;
    const handler = setTimeout(async () => {
      setIsScrapingMeta(true);
      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL}/api/metadata` : 'https://markbel.vercel.app/api/metadata';
        const res = await fetch(`${apiUrl}?url=${encodeURIComponent(url.trim())}`);
        const meta = await res.json();
        if (meta && (meta.title || meta.description)) {
          setFetchedMeta(meta);
        }
      } catch (e) {
        console.warn('Scraper failed:', e);
      } finally {
        setIsScrapingMeta(false);
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [url]);

  useEffect(() => {
    async function setup() {
      await initDb();
      setDbInitialized(true);
      await initializeNotifications();
      await syncManager.registerDevice('mobile', '1.0.0');
      syncManager.startPeriodicSync();
      syncManager.subscribe(state => setSyncState(state));

      BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      }).catch(console.error);
    }
    setup();
  }, []);

  useEffect(() => {
    if (!dbInitialized) return;
    const db = SQLite.openDatabaseSync('markbel.db');
    
    const interval = setInterval(async () => {
      const rows = await db.getAllAsync(`SELECT * FROM bookmarks WHERE deletedAt IS NULL ORDER BY createdAt DESC`) as Bookmark[];
      setBookmarks(rows.map(r => ({ ...r, tags: JSON.parse((r.tags as any) || '[]') })));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [dbInitialized]);

  const handleAdd = async () => {
    if (!url) return;
    await bookmarkRepository.create({
      id: crypto.randomUUID(),
      url,
      title: title || url,
      description: description || '',
      group: group || 'Read Later',
      tags: [],
    });
    setUrl('');
    setTitle('');
    setDescription('');
    setGroup('');
    setFetchedMeta(null);
    syncManager.sync();
  };

  const handleDelete = async (id: string) => {
    await bookmarkRepository.delete(id);
    syncManager.sync();
  };

  if (!dbInitialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Markbel</Text>
        <View style={styles.syncContainer}>
          {syncState === SyncState.Syncing && <ActivityIndicator size="small" color="#666" style={{marginRight: 4}}/>}
          <Text style={styles.syncStatus}>{syncState === SyncState.Syncing ? 'Syncing...' : 'Synced'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Add New Bookmark</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="https://example.com/..." 
            value={url} 
            onChangeText={(t) => { setUrl(t); setFetchedMeta(null); }} 
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {isScrapingMeta && (
            <Text style={styles.metaStatus}>Fetching link details...</Text>
          )}

          {fetchedMeta && !isScrapingMeta && (
            <View style={styles.metaBanner}>
              <View style={styles.metaInfo}>
                <Text style={styles.metaBannerTitle}>✨ Details Found</Text>
                <Text style={styles.metaBannerText} numberOfLines={1}>{fetchedMeta.title}</Text>
              </View>
              <TouchableOpacity 
                style={styles.autoFillBtn}
                onPress={() => {
                  if (!title) setTitle(fetchedMeta.title);
                  if (!description) setDescription(fetchedMeta.description);
                  setFetchedMeta(null);
                }}
              >
                <Text style={styles.autoFillBtnText}>Auto-fill</Text>
              </TouchableOpacity>
            </View>
          )}

          <TextInput 
            style={styles.input} 
            placeholder="Title" 
            value={title} 
            onChangeText={setTitle} 
          />
          
          <View style={styles.row}>
            <TextInput 
              style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]} 
              placeholder="Collection (e.g. Read Later)" 
              value={group} 
              onChangeText={setGroup} 
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
              <Text style={styles.submitBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <FlatList
        data={bookmarks}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.group || 'Read Later'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardUrl} numberOfLines={1}>{item.url}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF9F6', zIndex: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  syncContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  syncStatus: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  formContainer: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, marginBottom: 12, backgroundColor: '#F9FAFB', fontSize: 15, color: '#1F2937' },
  row: { flexDirection: 'row', alignItems: 'center' },
  submitBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 50 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  metaStatus: { fontSize: 12, color: '#6B7280', marginBottom: 12, fontStyle: 'italic' },
  metaBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 10, padding: 12, marginBottom: 12 },
  metaInfo: { flex: 1, marginRight: 12 },
  metaBannerTitle: { fontSize: 12, fontWeight: 'bold', color: '#1E40AF', marginBottom: 2 },
  metaBannerText: { fontSize: 13, color: '#3B82F6' },
  autoFillBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  autoFillBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  listContent: { padding: 20, paddingTop: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#4B5563', textTransform: 'uppercase' },
  deleteText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4, lineHeight: 22 },
  cardUrl: { fontSize: 13, color: '#9CA3AF' }
});
