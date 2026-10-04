/**
 * The Node entry the desktop spawns.
 *
 * It exists for three reasons:
 *   1. Harness and its plugins spawn their own children. Plugins re-invoke the
 *      dsh CLI through the executable running them, so those children must be
 *      declared Node processes or they boot as a second Electron app.
 *   2. The Harness entry is gated on `import.meta.main`, which is false when it
 *      is imported rather than executed — so we import it and call `runCli`.
 *   3. Plugin failures otherwise reach only an in-memory log ring; here they
 *      reach the desktop's log file.
 */

import { pathToFileURL } from 'node:url'
import { registerHostModuleFallback } from './host-module-fallback.mjs'

if (process.versions.electron !== undefined) process.env.ELECTRON_RUN_AS_NODE = '1'

const [dshEntryPath, ...dshArguments] = process.argv.slice(2)

/** @param {string} label @param {unknown} value */
function report(label, value) {
  process.stderr.write(`[harness-node] ${label}: ${value}\n`)
}

/**
 * Send loader-owned identity before the human-readable error, without
 * serialising arbitrary Error properties or the whole context graph.
 * @param {unknown} error
 */
function reportPluginFailures(error) {
  const failures = []
  const visited = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return false
    visited.add(value)
    let nested = visit(value.cause)
    if (value instanceof AggregateError) {
      for (const child of value.errors) nested = visit(child) || nested
    }
    const failure = value.dshPluginFailure
    if (!nested && failure && typeof failure === 'object') {
      const { stage, entryId, packageName, owner, chain, message } = failure
      failures.push({ stage, entryId, packageName, owner, chain, message })
      return true
    }
    return nested
  }
  visit(error)
  if (failures.length) report('plugin failures', JSON.stringify({ version: 1, failures }))
}

process.on('uncaughtException', (error) => report('uncaught exception', error?.stack ?? error))
process.on('unhandledRejection', (error) => report('unhandled rejection', error?.stack ?? error))
process.stdout.write(
  `[harness-node] node=${process.version} platform=${process.platform} arch=${process.arch}\n`,
)
process.stdout.write(`[harness-node] DSH_HOME=${process.env.DSH_HOME ?? ''}\n`)

if (!dshEntryPath) {
  report('startup error', 'missing DSH entry path')
  process.exitCode = 1
} else {
  process.stdout.write(`[harness-node] loading=${dshEntryPath}\n`)
  process.argv = [process.execPath, dshEntryPath, ...dshArguments]
  try {
    registerHostModuleFallback(dshEntryPath)
    const entry = await import(pathToFileURL(dshEntryPath).href)
    process.stdout.write('[harness-node] DSH entry loaded\n')
    if (typeof entry.runCli === 'function') await entry.runCli()
  } catch (error) {
    reportPluginFailures(error)
    report('DSH entry failed', error?.stack ?? error)
    process.exitCode = 1
  }
}
