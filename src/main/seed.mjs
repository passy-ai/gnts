// Lay down the harness profile on first run.
//
// Without this, a freshly installed app has an empty DSH_HOME: no profile, so no
// plugins resolve, and it boots with none of the gnts.dev UI. That is not a fresh
// install, it is a broken one — and it is invisible until you clear the data and try.
//
// What the profile needs:
//   cordis.patch.yml     which stock entries are disabled and which are mounted
//   package.json         the bundle list (dsh.profile.bundles)
//   node_modules/<name>  each plugin, resolvable by name
//
// The links are made with symlinks rather than a package manager: a bundled app
// cannot assume pnpm exists, and `link:` deps resolve to exactly this.
//
// Existing files are never overwritten — a user who edits their profile keeps it.

import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs'
import { join } from 'node:path'

const PATCH = 'gnts.patch.yml'
const PROFILE_MANIFEST = 'gnts.profile.json'

/**
 * @param {{ dshHome: string, resourcesPath: string, pluginsDir: string, log?: (m: string) => void }} opts
 */
export function seedProfile({ dshHome, resourcesPath, pluginsDir, log = () => {} }) {
  // The app ships its own plugins; a local checkout is the development fallback.
  const shipped = join(resourcesPath, 'plugins')
  const plugins = existsSync(shipped) ? shipped : pluginsDir

  const web = join(dshHome, 'profiles', 'web')
  const modules = join(web, 'node_modules')
  const patch = join(web, 'cordis.patch.yml')
  const manifest = join(web, 'package.json')

  const fresh = !existsSync(patch)
  mkdirSync(modules, { recursive: true })

  // 1. the composition file, from the shipped copy
  if (!existsSync(patch)) {
    const from = join(resourcesPath, PATCH)
    if (existsSync(from)) {
      writeFileSync(patch, readFileSync(from))
      log(`[seed] profile patch installed`)
    } else {
      log(`[seed] no ${PATCH} in resources — the profile will be empty`)
    }
  }

  // 2. the bundle list. This is shipped as a template rather than generated: the list
  //    must keep the base entries (@deepseek-ai/dsh-base, dsh-web-app) or there is
  //    nothing to boot — generating it from a directory listing dropped exactly those,
  //    and the harness stalled after loading its entry with no error at all.
  if (!existsSync(manifest) || !fileHasBundles(manifest)) {
    const template = join(resourcesPath, PROFILE_MANIFEST)
    if (existsSync(template)) {
      const d = JSON.parse(readFileSync(template, 'utf8'))
      const deps = d.dependencies || {}
      // Point each shipped plugin at the copy this app carries. Matching on the `gnts-`
      // prefix alone missed anything else we ship — dsh-model-default kept the literal
      // placeholder and the harness could not resolve it, so the bundle was skipped.
      for (const name of Object.keys(deps)) {
        const shippedHere = existsSync(join(plugins, name))
        if (name.startsWith('gnts-') || shippedHere || String(deps[name]).indexOf('PLACEHOLDER') !== -1) {
          deps[name] = `link:${join(plugins, name)}`
        }
      }
      // dshmarket is a normal npm dependency, not one of our links. If the app does not
      // ship it, drop it from both the deps and the bundles rather than leaving a
      // dependency that can never be satisfied.
      const market = join(resourcesPath, 'node_modules', 'dshmarket')
      if (deps.dshmarket && !existsSync(market)) {
        delete deps.dshmarket
        const b = d?.dsh?.profile?.bundles
        if (Array.isArray(b)) d.dsh.profile.bundles = b.filter((x) => x !== 'dshmarket')
      }
      writeFileSync(manifest, JSON.stringify(d, null, 2) + '\n')
      log(`[seed] profile manifest written from the template (${(d.dsh?.profile?.bundles || []).length} bundles)`)
    } else {
      log(`[seed] no ${PROFILE_MANIFEST} in resources — cannot build a profile`)
    }
  }

  // 3. make each one resolvable by name
  let linked = 0
  if (existsSync(pluginsDir)) {
    for (const name of readdirSync(plugins)) {
      // every plugin this app ships, not only the gnts- prefixed ones
      if (!name.startsWith('gnts-') && !name.startsWith('dsh-')) continue
      const target = join(modules, name)
      if (existsSync(target) || isLink(target)) continue
      try {
        symlinkSync(join(plugins, name), target, 'dir')
        linked++
      } catch (e) {
        log(`[seed] could not link ${name}: ${e.message}`)
      }
    }
  } else {
    log(`[seed] no plugins at ${plugins} or ${pluginsDir}`)
  }

  if (fresh || linked) log(`[seed] ${fresh ? 'new' : 'existing'} profile, ${linked} plugin(s) linked`)
  return { fresh, linked, profile: web }
}

function isLink(p) {
  try { return lstatSync(p).isSymbolicLink() } catch { return false }
}

function fileHasBundles(p) {
  try {
    const d = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(d?.dsh?.profile?.bundles) && d.dsh.profile.bundles.length > 0
  } catch { return false }
}
