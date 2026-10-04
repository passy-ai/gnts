/** Every path the desktop layer owns, resolved in one place. */

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Resolve our paths. Nothing here changes the shared Harness data roots: the
 * desktop keeps its own `harness` directory beside the app's userData.
 * @param {{ userData: string, logs: string, appPath: string, resourcesPath: string }} app
 * @returns {{ dshHome: string, profile: string, logPath: string, launchRoot: string,
 *             nodeEntryPath: string, patchPath: string, dshEntryPath: string }}
 */
export function resolvePaths(app) {
  const dshHome = join(app.userData, 'harness')
  return {
    dshHome,
    profile: 'web',
    logPath: join(app.logs, 'harness.log'),
    launchRoot: join(app.userData, 'launch-root'),
    nodeEntryPath: join(app.resourcesPath, 'harness-node-entry.mjs'),
    patchPath: join(app.resourcesPath, 'gnts.patch.yml'),
    dshEntryPath: resolveDshEntry(app.appPath, app.resourcesPath),
  }
}

/**
 * The harness entry we spawn.
 *
 * Pinned by our own dependency when installed, so upgrades are deliberate.
 * `GNTS_DSH_ENTRY` overrides it, which is how we develop against another
 * installation (the CLI kit's, or a checkout) without touching this one.
 * @param {string} appPath - the application directory, or its asar.
 * @returns {string} absolute path to the harness CLI entry.
 */
export function resolveDshEntry(appPath, resourcesPath) {
  if (process.env.GNTS_DSH_ENTRY) return process.env.GNTS_DSH_ENTRY

  // Packaged: the dependency tree ships in Resources (see electron-builder.config.mjs),
  // so resolve from there rather than from the asar.
  if (resourcesPath !== undefined) {
    const unpacked = join(resourcesPath, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (existsSync(unpacked)) return unpacked
  }

  const require = createRequire(join(appPath, 'package.json'))
  let manifest
  try {
    manifest = require.resolve('@deepseek-ai/dsh/package.json')
  } catch {
    throw new Error('gnts: cannot resolve @deepseek-ai/dsh — set GNTS_DSH_ENTRY to a dsh entry')
  }
  const candidates = [join(dirname(manifest), 'lib', 'bin.js'), join(dirname(manifest), 'bin.js')]
  for (const candidate of candidates) if (existsSync(candidate)) return candidate
  throw new Error(`gnts: no harness entry beside ${manifest}`)
}
