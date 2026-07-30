import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  sqliteQuery: (sql: string, params: any[] = []) => ipcRenderer.invoke('sqlite-query', sql, params),
  sqliteTransaction: (queries: {sql: string, params: any[]}[]) => ipcRenderer.invoke('sqlite-transaction', queries),
  scheduleNotification: (payload: any, triggerAtUtc: string) => ipcRenderer.invoke('schedule-notification', payload, triggerAtUtc),
  cancelNotification: (id: string) => ipcRenderer.invoke('cancel-notification', id),
  onNotificationClick: (callback: (payload: any) => void) => {
    ipcRenderer.on('notification-click', (_event, payload) => callback(payload));
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
