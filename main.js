const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')

app.setName('Farsight Keep')

// Prevent two instances from ever running against the same userData files at once.
// Without this, two windows loaded at different times can each hold their own stale
// in-memory copy of campaigns.json/compendium.json - whichever one saves last silently
// overwrites the other's changes (including things the other window created, like a
// new Adventure), with no warning and no conflict detection anywhere in storage.js.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to launch a second copy - focus the existing window instead of
    // letting a second, independent copy of the data load into memory.
    const existing = BrowserWindow.getAllWindows()[0]
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  win.loadFile('index.html')

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1)
  })
}

// ── File dialog for opening XML or images ────────────────────────
ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// ── Read a file as base64 (for images) ───────────────────────────
ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath)
    const ext  = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,` + data.toString('base64')
  } catch(e) { return null }
})

// ── Read a file as text (for XML) ────────────────────────────────
ipcMain.handle('read-file-text', async (event, filePath) => {
  try { return fs.readFileSync(filePath, 'utf8') }
  catch(e) { return null }
})

// ── Expose Electron's standard userData path to the renderer ────
ipcMain.on('get-user-data-path', (event) => {
  event.returnValue = app.getPath('userData')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})