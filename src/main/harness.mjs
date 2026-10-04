/**
 * Spawn DeepSeek Harness, reserve its loopback port, and wait until it is
 * actually serving. This is the whole core of the desktop layer: everything
 * else in this app is window, bridge or packaging.
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** A stable preferred port, so the window origin does not change per launch. */
export const DEFAULT_PORT = 43900

/**
 * The line Harness prints once its plugin tree has loaded and its web server is
 * serving. It is the only trustworthy readiness signal.
 */
const LAUNCH_LINE = /\bdsh web:\s*(\S+)/u

/**
 * Pull the launch token out of one line of Harness output.
 * @param {string} line
 * @returns {string | undefined}
 */
export function extractLaunchToken(line) {
  const match = LAUNCH_LINE.exec(line)
  if (!match?.[1]) return undefined
  try {
    const token = new URL(match[1]).searchParams.get('token')
    return token ? token : undefined
  } catch {
    return undefined
  }
}

/**
 * Bind a loopback port: the preferred one when it is free, otherwise any free
 * port. The socket is closed again before Harness binds it, so a taken port
 * simply falls back rather than failing.
 * @param {number} preferred
 * @returns {Promise<{ port: number, usedPreferred: boolean }>}
 */
export async function reservePort(preferred) {
  const attempt = (candidate) =>
    new Promise((resolve) => {
      const server = createServer()
      server.unref()
      server.once('error', () => resolve(undefined))
      server.listen({ host: '127.0.0.1', port: candidate }, () => {
        const port = server.address()?.port
        server.close(() => resolve(port))
      })
    })

  const first = await attempt(preferred)
  if (first !== undefined) return { port: first, usedPreferred: true }
  const fallback = await attempt(0)
  if (fallback === undefined) throw new Error('gnts: no free loopback port')
  return { port: fallback, usedPreferred: false }
}

/**
 * The Harness CLI arguments. `--no-open` keeps it from handing the URL to the
 * system browser; `--host 127.0.0.1` keeps it off the network.
 * @param {string} dshEntryPath
 * @param {number} port
 * @param {{ profile?: string, patches?: readonly string[] }} [options]
 * @returns {string[]}
 */
export function buildHarnessArguments(dshEntryPath, port, options = {}) {
  const profile = options.profile ?? 'web'
  const patches = options.patches ?? []
  return [
    dshEntryPath,
    ...(profile === 'web' ? ['web'] : ['--profile', profile]),
    ...patches.flatMap((patch) => ['--patch', patch]),
    '--no-open',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
  ]
}

export class HarnessRuntime {
  #child
  #log
  #token
  #state = 'idle'

  /** @param {object} options */
  constructor(options) {
    this.options = options
  }

  get state() {
    return this.#state
  }

  /** The token Harness printed, once it has printed one. */
  get token() {
    return this.#token
  }

  /**
   * Start Harness and resolve once it serves, or reject with why it did not.
   * @returns {Promise<{ url: string, token: string | undefined }>}
   */
  async start() {
    const { port, usedPreferred } = await reservePort(this.options.preferredPort ?? DEFAULT_PORT)
    const url = `http://127.0.0.1:${port}`

    mkdirSync(dirname(this.options.logPath), { recursive: true })
    mkdirSync(this.options.cwd, { recursive: true })
    this.#log = createWriteStream(this.options.logPath, { flags: 'a' })
    this.#note(`starting ${new Date().toISOString()}`)
    this.#note(`endpoint ${url}${usedPreferred ? '' : ' (preferred port was busy)'}`)

    const args = buildHarnessArguments(this.options.dshEntryPath, port, {
      profile: this.options.profile,
      patches: this.options.patches,
    })
    this.#note(`profile ${this.options.profile}`)

    this.#state = 'starting'
    this.#child = spawn(this.options.nodeExecutablePath, [this.options.nodeEntryPath, ...args], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        DSH_HOME: this.options.dshHome,
        // Children of Harness re-invoke the dsh CLI. Without this they boot as
        // Electron apps instead of Node processes.
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      // A process group, so stopping Harness also stops what it spawned.
      detached: process.platform !== 'win32',
    })

    const exited = new Promise((resolve) => this.#child.once('exit', resolve))
    this.#child.once('error', (error) => this.#note(`spawn failed: ${String(error)}`))

    const consume = (chunk) => {
      const text = String(chunk)
      this.#log?.write(text)
      const token = extractLaunchToken(text)
      if (token && !this.#token) {
        this.#token = token
        this.#note('launch token seen')
      }
    }
    this.#child.stdout.on('data', consume)
    this.#child.stderr.on('data', consume)

    const ready = await this.#waitUntilReady(url, exited, this.options.startupTimeoutMs ?? 60_000)
    if (!ready) {
      this.stop()
      this.#state = 'failed'
      throw new Error(`gnts: Harness did not become ready — see ${this.options.logPath}`)
    }

    this.#state = 'ready'
    this.#note('ready')
    return { url, token: this.#token }
  }

  /** Stop Harness and everything it spawned. Safe to call more than once. */
  stop() {
    const child = this.#child
    this.#child = undefined
    this.#state = 'idle'
    if (!child || child.exitCode !== null) return
    try {
      if (process.platform === 'win32') child.kill()
      else process.kill(-child.pid, 'SIGTERM')
    } catch {
      // Already gone; nothing to do.
    }
  }

  #note(line) {
    this.#log?.write(`[gnts] ${line}\n`)
  }

  /**
   * Poll until Harness answers, or the process exits, or we run out of time.
   * @param {string} url
   * @param {Promise<unknown>} exited
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  async #waitUntilReady(url, exited, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.#child === undefined || this.#child.exitCode !== null) return false
      try {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1_000) })
        if (response.status < 500) return true
      } catch {
        // Not listening yet.
      }
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 300)),
        exited.then(() => undefined),
      ])
    }
    return false
  }
}
