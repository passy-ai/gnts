/**
 * gnts.dev — the desktop shell.
 *
 * The app owns one window, one Harness process and one profile. Everything it
 * shows is Harness's own web UI; everything it adds is a preload bridge.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { session } from 'electron'
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
let gateway

/** The gateway's fixed port — the tunnel's ingress target, so it must not move. */
const GATEWAY_PORT = 8080

/**
 * Publish the harness's launch token where the gateway reads it.
 *
 * Called before every window load, not once: the harness mints a new token each
 * launch, and our supervisor restarts it after a crash — so a file written only
 * at boot goes stale and the gateway proxies with a token the harness rejects,
 * which is the 401 body a public URL showed.
 * @param {string | undefined} token
 * @param {string} remoteDir
 */
function publishWebToken(token, remoteDir) {
  if (!token) return
  try {
    mkdirSync(remoteDir, { recursive: true, mode: 0o700 })
    writeFileSync(join(remoteDir, 'web-token'), token, { mode: 0o600 })
  } catch (error) {
    runtime?.note(`[gnts] could not publish the web token: ${String(error)}`)
  }
}

/** Code alphabet and length the gateway redeems. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Pair this app with its own gateway, silently.
 *
 * The gateway gates everything behind a paired-device session cookie, and its
 * unpaired surface is the QR/code pairing page. The desktop app should never see
 * that page: it mints a code the same way the CLI does and redeems it over
 * loopback, then stores the resulting cookie in the window's session — so the app
 * is simply another paired device, with nothing to scan and nothing to type. The
 * cookie is durable, so this happens once, not on every launch.
 * @param {string} origin - the gateway's loopback origin.
 * @param {{ dshHome: string }} paths
 * @returns {Promise<boolean>}
 */
async function pairSelf(origin, paths) {
  const cookieUrl = `${origin}/`
  const has = async () => (await session.defaultSession.cookies.get({ url: cookieUrl }))
    .some((cookie) => cookie.name === 'dsh_session')
  if (await has()) return true

  const codesDir = join(app.getPath('userData'), 'remote', 'codes')
  mkdirSync(codesDir, { recursive: true, mode: 0o700 })
  let code = ''
  for (const byte of randomBytes(8)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  writeFileSync(join(codesDir, `${createHash('sha256').update(code).digest('hex')}.code`),
    String(Date.now() + 10 * 60 * 1000), { mode: 0o600 })

  let response
  try {
    response = await fetch(`${origin}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, label: 'gnts.dev desktop' }).toString(),
    })
  } catch (error) {
    runtime?.note(`[gnts] pairing request failed: ${String(error)}`)
    return false
  }

  const headers = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  for (const header of headers) {
    const parts = String(header).split(';')
    const eq = parts[0].indexOf('=')
    if (eq <= 0) continue
    const name = parts[0].slice(0, eq).trim()
    const value = parts[0].slice(eq + 1).trim()
    // Honour Max-Age: without an expiry this is a session cookie that dies with
    // the app, so every launch would pair a new device.
    let expirationDate
    for (const attribute of parts.slice(1)) {
      const match = /^\s*max-age\s*=\s*(\d+)\s*$/i.exec(attribute)
      if (match) expirationDate = Math.floor(Date.now() / 1000) + Number(match[1])
    }
    try {
      await session.defaultSession.cookies.set({ url: cookieUrl, name, value, path: '/', httpOnly: true, sameSite: 'lax', expirationDate })
    } catch (error) {
      runtime?.note(`[gnts] could not store ${name}: ${String(error)}`)
    }
  }
  const paired = await has()
  runtime?.note(paired ? '[gnts] paired with the gateway as "gnts.dev desktop"' : `[gnts] pairing returned ${response.status} with ${headers.length} cookie(s)`)
  return paired
}

/**
 * Poll until a URL answers, or give up.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1000) })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  return false
}

/**
 * A window that can only ever show the local Harness.
 * @returns {BrowserWindow}
 */
function createWindow() {
  const created = new BrowserWindow({
    width: 1280,
    height: 820,
    // 360, so the window can be dragged down to phone width. It was clamped at
    // 1024 while the client's narrow layout broke the rail and the file panel;
    // our own sidebar and folders packages fixed both, so the clamp is gone.
    minWidth: 360,
    show: false,
    // The sidebar is deliberately transparent on macOS (the stock rule is
    // background: 0 0), so what shows through it is the window's material. Without
    // vibrancy there is nothing behind it and it renders as flat opaque grey.
    // 'sidebar' is the material the reference uses, with a transparent window
    // background so the desktop bleeds through.
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#0a0a0a',
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: 'active',
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

  // Client-side plugin failures only ever reach the renderer console, so without
  // this they are invisible outside the window. Electron changed this event's
  // shape, so accept both.
  created.webContents.on('console-message', (...args) => {
    const details = args[0]
    const message = typeof details?.message === 'string' ? details.message : args[2]
    const level = typeof details?.level === 'string' ? details.level : args[1]
    if (typeof message === 'string') runtime?.note(`[page:${level}] ${message}`)
  })

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
    const { url, token } = await runtime.start()

    // The gateway authenticates every request it proxies with the harness's launch
    // token, read from <DSH_REMOTE_DIR>/web-token. Without it the gateway forwards
    // unauthenticated and the harness answers 401 — which is what a public tunnel
    // URL showed instead of the UI. It reads the file on demand, so writing once
    // here is enough.
    if (token) {
      const remoteDir = join(app.getPath('userData'), 'remote')
      mkdirSync(remoteDir, { recursive: true, mode: 0o700 })
      writeFileSync(join(remoteDir, 'web-token'), token, { mode: 0o600 })

      // The tunnel connector needs its own token, and a box that already has one
      // keeps it in the kit's directory. Reuse it rather than making the operator
      // re-authenticate: copy once, and leave it alone after that.
      const kitToken = join(app.getPath('home'), '.dsh-remote', 'cloudflared.token')
      const ourToken = join(remoteDir, 'cloudflared.token')
      if (!existsSync(ourToken) && existsSync(kitToken)) {
        try {
          copyFileSync(kitToken, ourToken)
          chmodSync(ourToken, 0o600)
          runtime.note('[gnts] reused the existing cloudflared token')
        } catch (error) {
          runtime.note(`[gnts] could not reuse the tunnel token: ${String(error)}`)
        }
      }
    }

    // The gateway sits in front of the harness: it is the same origin the window
    // loads, and it owns the flows the harness has no routes for — device pairing
    // (/devices, /devices/newcode, /devices/revoke), the pairing dashboard, the
    // invite pages and the tunnel. Without it those buttons POST into nothing.
    const harnessPort = new URL(url).port
    gateway = spawn(process.execPath, [join(resourcesPath, 'gateway.cjs')], {
      cwd: paths.launchRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DSH_REMOTE_HOST: '127.0.0.1',
        DSH_REMOTE_PORT: String(GATEWAY_PORT),
        DSH_REMOTE_UPSTREAM: `127.0.0.1:${harnessPort}`,
        DSH_REMOTE_DIR: join(app.getPath('userData'), 'remote'),
        // The shell owns cloudflared's lifecycle here, not a launchd job.
        DSH_REMOTE_TUNNEL_MANAGED: 'gateway',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
    gateway.stdout.on('data', (b) => runtime.note(`[gateway] ${String(b).trimEnd()}`))
    gateway.stderr.on('data', (b) => runtime.note(`[gateway] ${String(b).trimEnd()}`))
    const gatewayUrl = `http://127.0.0.1:${GATEWAY_PORT}`
    if (!(await waitForHttp(gatewayUrl, 20_000))) throw new Error(`gnts: the gateway did not start on ${GATEWAY_PORT}`)
    allowedOrigin = gatewayUrl
    await pairSelf(gatewayUrl, paths)
    const remoteDir = join(app.getPath('userData'), 'remote')
    publishWebToken(token, remoteDir)
    // Keep it current rather than trusting one write. The harness mints a token per
    // launch and the supervisor restarts it, so any single publish goes stale — and
    // the gateway then proxies with a token the harness rejects, which is the 401
    // body that keeps appearing instead of the UI. The gateway re-reads the file on
    // every request, so keeping the file fresh is the whole fix.
    const tokenTimer = setInterval(() => { publishWebToken(runtime.token, remoteDir) }, 2000)
    tokenTimer.unref?.()
    app.on('before-quit', () => { clearInterval(tokenTimer) })
    await window.loadURL(gatewayUrl)
    return
    allowedOrigin = url
    // Only `GET /?token=...` trades the launch token for the signed session
    // cookie; API paths and Authorization headers refuse it. So the first
    // navigation must carry the token, and Chromium keeps the cookie for every
    // later request on this origin. A reload with a stale token is redirected
    // to a clean `/` while the cookie is still valid.
    const first = new URL(url)
    if (token) first.searchParams.set('token', token)
    if (window && !window.isDestroyed()) await window.loadURL(first.toString())
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

// Development escape hatch: point the app at a throwaway data directory so a
// test run cannot touch a real installation's DSH_HOME.
if (process.env.GNTS_USER_DATA) app.setPath('userData', process.env.GNTS_USER_DATA)

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
    if (gateway && gateway.exitCode === null) {
      try {
        if (process.platform === 'win32') gateway.kill()
        else process.kill(-gateway.pid, 'SIGTERM')
      } catch {
        // already gone
      }
    }
  })
}
