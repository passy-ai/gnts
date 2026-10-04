/**
 * Let linked plugins consume the Harness packages this app carries.
 *
 * Node resolves a symlinked plugin's imports from the plugin's physical source
 * directory, which normally has no node_modules of its own — while the peer
 * packages live beside the Harness entry. Preserve the plugin's normal
 * resolution first, and only retry missing @deepseek-ai packages from the
 * installation anchor.
 */

import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

const HOST_PACKAGE_PREFIX = '@deepseek-ai/'

/**
 * Failures the installation anchor can legitimately answer.
 *
 * ERR_MODULE_NOT_FOUND is the plugin having no copy at all.
 * ERR_PACKAGE_PATH_NOT_EXPORTED is the copy it found being older than the
 * subpath its importer needs. Retrying is safe: the retry only succeeds when
 * the host copy really exports that subpath.
 */
const RETRYABLE = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'])

/**
 * @param {string} dshEntryPath - the Harness entry the plugins resolve against.
 * @returns {unknown} the registered hooks.
 */
export function registerHostModuleFallback(dshEntryPath) {
  const hostEntryUrl = pathToFileURL(dshEntryPath).href
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context)
      } catch (error) {
        if (!specifier.startsWith(HOST_PACKAGE_PREFIX) || !RETRYABLE.has(error?.code)) throw error
        try {
          return nextResolve(specifier, { ...context, parentURL: hostEntryUrl })
        } catch (hostError) {
          // Only the first failure names the importing plugin, so keep it.
          error.message += `\n  host fallback from ${hostEntryUrl} also failed: ${hostError.message}`
          error.cause ??= hostError
          throw error
        }
      }
    },
  })
}
