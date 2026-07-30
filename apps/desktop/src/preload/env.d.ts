export {}

declare global {
  interface Window {
    api: {
      sqliteQuery: (sql: string, params?: any[]) => Promise<any>
      sqliteTransaction: (queries: {sql: string, params: any[]}[]) => Promise<any[]>
      scheduleNotification: (payload: any, triggerAtUtc: string) => Promise<void>
      cancelNotification: (id: string) => Promise<void>
      onNotificationClick: (callback: (payload: any) => void) => void
    }
  }
}
