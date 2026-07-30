import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Register default protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('markbel', process.execPath, [join(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('markbel')
}

// Ensure single instance for deep linking
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    
    // Look for the deep link URL in the arguments
    const deepLinkUrl = commandLine.find(arg => arg.startsWith('markbel://'))
    if (deepLinkUrl && mainWindow) {
      // Send the deep link to the renderer if needed
      mainWindow.webContents.send('deep-link', deepLinkUrl)
    }
  })
}



function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Prevent app from quitting when window is closed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
    return false
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.markbel')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Check if opened via deep link on first launch
  const deepLinkUrl = process.argv.find(arg => arg.startsWith('markbel://'))
  if (deepLinkUrl && mainWindow) {
    mainWindow.webContents.send('deep-link', deepLinkUrl)
  }
  
  const iconPath = join(app.getAppPath(), 'build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Markbel', click: () => mainWindow?.show() },
    { type: 'separator' },
    { 
      label: 'Launch on Startup', 
      type: 'checkbox', 
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: app.getPath('exe')
        });
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true
      app.quit()
    }}
  ])
  tray.setToolTip('Markbel Sync')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    mainWindow?.show()
  })


  


  // Notifications IPC
  ipcMain.handle('schedule-notification', (event, payload: any, triggerAtUtc: string) => {
    import('electron').then(({ Notification }) => {
      if (Notification.isSupported()) {
        const triggerDate = new Date(triggerAtUtc).getTime();
        const delay = triggerDate - Date.now();
        if (delay <= 0) {
          const notif = new Notification({ title: payload.title, body: payload.body });
          notif.on('click', () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              // Optionally send event to renderer for deep linking
              mainWindow.webContents.send('notification-click', payload.deepLink);
            }
          });
          notif.show();
        } else {
          // Native delayed notifications are tricky without cron/background daemon. 
          // Similar to web, we'll rely on setTimeout if app is running, and startup recovery if closed.
          setTimeout(() => {
            const notif = new Notification({ title: payload.title, body: payload.body });
            notif.on('click', () => {
              if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
                mainWindow.webContents.send('notification-click', payload.deepLink);
              }
            });
            notif.show();
          }, delay);
        }
      }
    });
  });

  ipcMain.handle('cancel-notification', (event, id: string) => {
    // For now, no-op just like web if we don't hold the timeout handles in memory.
    // Real implementation would cancel the timeout or OS level scheduled task.
  });

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Do nothing. The app stays alive in the tray.
})
