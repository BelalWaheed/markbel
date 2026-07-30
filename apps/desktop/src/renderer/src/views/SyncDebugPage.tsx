import React, { useEffect, useState } from 'react';
import { db } from '../db/db';
import { syncManager, SyncState } from '../db/SyncManager';
import { 
  Server, 
  RefreshCw, 
  Activity,
  AlertTriangle,
  UploadCloud,
  DownloadCloud,
  Database,
  Trash2,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function SyncDebugPage() {
  const [state, setState] = useState<SyncState>(syncManager.currentState);
  const [isLeader, setIsLeader] = useState<boolean>(syncManager.leaderStatus);
  const [deviceId, setDeviceId] = useState<string>('');
  const [cursor, setCursor] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string>('-');
  const [metrics, setMetrics] = useState(syncManager.metrics);
  const { showToast } = useToast();

  const loadData = async () => {
    setIsLeader(syncManager.leaderStatus);
    setMetrics({ ...syncManager.metrics });
    
    const config = await db.appConfig.get('deviceId');
    if (config) setDeviceId(config.value);

    const meta = await db.syncMetadata.get('bookmark-sync');
    if (meta) {
      setCursor(meta.cursor || 0);
      setLastSync(meta.lastSuccessfulSyncAt ? new Date(meta.lastSuccessfulSyncAt).toLocaleString() : '-');
    }

    const pending = await db.syncOutbox.count();
    setPendingCount(pending);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    
    const unsubscribe = syncManager.subscribe((newState) => {
      setState(newState);
      loadData();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleForceSync = async () => {
    try {
      await syncManager.sync(true);
      showToast('Success', 'Force sync completed', 'success');
      loadData();
    } catch (err: any) {
      showToast('Error', err.message || 'Sync failed', 'error');
    }
  };

  const handleForcePush = async () => {
    // For now force push just delegates to sync since we do it in order
    await handleForceSync();
  };

  const handleForcePull = async () => {
    await handleForceSync();
  };

  const handleClearOutbox = async () => {
    if (window.confirm("Are you sure? This will delete all pending offline changes.")) {
      await db.syncOutbox.clear();
      showToast('Cleared', 'Outbox cleared', 'success');
      loadData();
    }
  };

  const handlePauseSync = () => {
    syncManager.pauseSync();
    showToast('Paused', 'Background sync paused', 'success');
    loadData();
  };

  const handleResumeSync = () => {
    syncManager.resumeSync();
    showToast('Resumed', 'Background sync resumed', 'success');
    loadData();
  };

  const handleResetCursor = async () => {
    if (window.confirm("Are you sure? This will force a full pull on the next sync.")) {
      await syncManager.resetCursor();
      showToast('Reset', 'Cursor reset to 0', 'success');
      loadData();
    }
  };

  const heartbeatAge = metrics.leaderHeartbeat ? Math.round((Date.now() - metrics.leaderHeartbeat) / 1000) : '-';

  return (
    <div className="p-8 max-w-4xl mx-auto dark:text-white pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="w-8 h-8 text-cyan-400" />
        <h1 className="text-3xl font-bold font-display">Sync Dashboard (Developer)</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Server className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Sync State</span>
          </div>
          <div className="text-2xl font-bold flex items-center gap-2">
            {state === SyncState.Syncing && <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />}
            {state === SyncState.Follower && <Database className="w-5 h-5 text-purple-400" />}
            {state === SyncState.Offline && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
            {state === SyncState.Idle && <Server className="w-5 h-5 text-green-400" />}
            {state}
          </div>
          <div className="mt-2 text-sm text-gray-400">
            Leader Status: <strong className={isLeader ? 'text-green-400' : 'text-gray-500'}>{isLeader ? 'LEADER' : 'FOLLOWER'}</strong>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <UploadCloud className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Outbox Pending</span>
          </div>
          <div className="text-3xl font-bold text-cyan-400">{pendingCount}</div>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <DownloadCloud className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Sync Cursor</span>
          </div>
          <div className="text-3xl font-bold text-pink-400">{cursor}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Device & Protocol</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Device ID</th>
                <td className="py-3 font-mono text-cyan-300 text-right">{deviceId || '-'}</td>
              </tr>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Protocol Version</th>
                <td className="py-3 font-mono text-right">v{metrics.protocolVersion}</td>
              </tr>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">DB Schema Version</th>
                <td className="py-3 font-mono text-right">v1</td>
              </tr>
              <tr>
                <th className="py-3 text-gray-400 font-medium">Leader Heartbeat Age</th>
                <td className="py-3 font-mono text-right">{heartbeatAge}s ago</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Telemetry Metrics</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Current Poll Interval</th>
                <td className="py-3 font-mono text-right">{metrics.currentPollIntervalMs}ms</td>
              </tr>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Last Push Duration</th>
                <td className="py-3 font-mono text-right">{metrics.lastPushDurationMs}ms</td>
              </tr>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Last Pull Duration</th>
                <td className="py-3 font-mono text-right">{metrics.lastPullDurationMs}ms</td>
              </tr>
              <tr className="border-b border-gray-700">
                <th className="py-3 text-gray-400 font-medium">Conflict / Retry Count</th>
                <td className="py-3 font-mono text-right text-orange-400">{metrics.conflictCount} / {metrics.retryCount}</td>
              </tr>
              <tr>
                <th className="py-3 text-gray-400 font-medium">Last Error</th>
                <td className="py-3 text-right text-red-400 break-all">{metrics.lastError || 'None'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 mb-8">
        <h2 className="text-xl font-bold mb-4">Development Controls</h2>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={handleForceSync}
            disabled={!isLeader || state === SyncState.Syncing}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Force Sync
          </button>
          
          <button 
            onClick={handleForcePush}
            disabled={!isLeader || state === SyncState.Syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <UploadCloud className="w-4 h-4" /> Force Push
          </button>
          
          <button 
            onClick={handleForcePull}
            disabled={!isLeader || state === SyncState.Syncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <DownloadCloud className="w-4 h-4" /> Force Pull
          </button>

          <button 
            onClick={handlePauseSync}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Pause className="w-4 h-4" /> Pause Sync
          </button>

          <button 
            onClick={handleResumeSync}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" /> Resume Sync
          </button>

          <button 
            onClick={handleResetCursor}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset Cursor
          </button>

          <button 
            onClick={handleClearOutbox}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear Outbox
          </button>
        </div>
      </div>
    </div>
  );
}
