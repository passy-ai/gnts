/**
 * gnts.dev — the desktop shell.
 *
 * The app owns one window, one Harness process and one profile. Everything it
 * shows is Harness's own web UI; everything it adds is a preload bridge.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HarnessRuntime } from './harness.mjs'
import { resolvePaths } from './paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** Our resources live beside the source in development and in Resources once packaged. */
const resourcesPath = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')

let runtime
let window
let allowedOrigin

/**
 * A window that can only ever show the local Harness.
 * @returns {BrowserWindow}
 */
function createWindow() {
  const created = new BrowserWindow({
    width: 1280,
    height: 820,
    // 1024, not smaller: Harness's client switches to its narrow layout below
    // 1024px, and a desktop window should not be laid out as a phone.
    minWidth: 1024,
    show: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(here, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  created.once('ready-to-show', () => created.show())

  // The window is a view onto loopback and nothing else. Anything else opens in
  // the user's browser, where it belongs.
  const permit = (url) => (allowedOrigin ? url.startsWith(allowedOrigin) : false)
  created.webContents.on('will-navigate', (event, url) => {
    if (!permit(url)) {
      event.preventDefault()
      if (url.startsWith('http')) void shell.openExternal(url)
    }
  })
  created.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  created.on('closed', () => {
    window = undefined
  })
  return created
}

/** The native directory picker Harness's host-side consumers expect to exist. */
function registerIpc() {
  ipcMain.handle('gnts:pick-directory', async () => {
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}

async function boot() {
  const paths = resolvePaths({
    userData: app.getPath('userData'),
    logs: app.getPath('logs'),
    appPath: app.getAppPath(),
    resourcesPath,
  })

  window = createWindow()

  runtime = new HarnessRuntime({
    dshEntryPath: paths.dshEntryPath,
    nodeEntryPath: paths.nodeEntryPath,
    nodeExecutablePath: process.execPath,
    dshHome: paths.dshHome,
    profile: paths.profile,
    patches: [paths.patchPath],
    logPath: paths.logPath,
    cwd: paths.launchRoot,
  })

  try {
    const { url } = await runtime.start()
    allowedOrigin = url
    if (window && !window.isDestroyed()) await window.loadURL(url)
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error)
    if (window && !window.isDestroyed()) {
      await window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<body style="font:14px system-ui;background:#0a0a0a;color:#eee;padding:2rem">
             <h1 style="font-size:16px">Harness did not start</h1>
             <pre style="white-space:pre-wrap">${message.replace(/</g, '&lt;')}</pre>
             <p style="opacity:.7">Log: ${paths.logPath}</p>
           </body>`,
        )}`,
      )
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    void boot()
    app.on('activate', () => {
      if (!window) window = createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('before-quit', () => {
    runtime?.stop()
  })
}
