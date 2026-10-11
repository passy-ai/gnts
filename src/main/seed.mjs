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
const MIGRATIONS_FILE = '.gnts-migrations.json'
const PROFILE_MANIFEST = 'gnts.profile.json'

/**
 * @param {{ dshHome: string, resourcesPath: string, pluginsDir: string, log?: (m: string) => void }} opts
 */
export function seedProfile({ dshHome, resourcesPath, pluginsDir, log = () => {} }) {
  // The shell the harness serves is inside node_modules, so it is not version-controlled
  // and a fresh checkout would not have the boot cover. Apply it here instead: the cover
  // has to be in the shell to paint before any module loads, and a plugin cannot do that.
  try {
    const shell = join(dshHome, '..', '..', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html')
    const cover = join(resourcesPath, 'shell', 'cover.html')
    const candidates = [shell, join(resourcesPath, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html')]
    for (const file of candidates) {
      if (!existsSync(file) || !existsSync(cover)) continue
      const html = readFileSync(file, 'utf8')
      if (html.indexOf('gnts-boot') !== -1) break
      const inject = readFileSync(cover, 'utf8')
      const style = inject.split('<div id="gnts-boot"')[0]
      const mark = '<div id="gnts-boot"' + inject.split('<div id="gnts-boot"')[1]
      writeFileSync(file, html.replace('  </head>', style + '  </head>').replace('    <div id="root"></div>', mark + '    <div id="root"></div>'))
      log('[seed] boot cover applied to the harness shell')
      break
    }
  } catch (e) { log('[seed] could not apply the shell cover: ' + e.message) }

  // The app ships its own plugins; a local checkout is the development fallback.
  const shipped = join(resourcesPath, 'plugins')
  const plugins = existsSync(shipped) ? shipped : pluginsDir

  const web = join(dshHome, 'profiles', 'web')
  const modules = join(web, 'node_modules')
  const patch = join(web, 'cordis.patch.yml')
  const manifest = join(web, 'package.json')

  const fresh = !existsSync(patch)
  mkdirSync(modules, { recursive: true })

  // 1. the composition file, from the shipped copy — and a one-shot repair of any stale
  //    pin. A pinned entry cannot be edited from the UI: it answers "configuration is
  //    overridden by a home patch" to every write. An older build pinned both `llm-pi-ai`
  //    (which claimed the whole providers key, so Autodiscover could never save a provider)
  //    and `dsh-market` (so the market could be neither installed nor removed). Those pins
  //    survive an upgrade in the profile, so they are removed here — ONCE. The plugins
  //    write these same ids themselves afterwards, so stripping them on every boot would
  //    delete providers the user adds and revert their plugin choices.
  {
    const from = join(resourcesPath, PATCH)
    if (existsSync(from)) {
      if (!existsSync(patch)) {
        writeFileSync(patch, readFileSync(from))
        log(`[seed] profile patch installed`)
      } else if (!appliedMigrations(dshHome).has(UNPIN_MIGRATION)) {
        const current = readFileSync(patch, 'utf8')
        const cleaned = stripPinnedBlocks(current, STALE_PINS)
        if (cleaned !== current) {
          writeFileSync(patch, cleaned)
          log(`[seed] removed ${STALE_PINS.join(', ')} from the patch — a pinned entry cannot be edited`)
        }
        recordMigration(dshHome, UNPIN_MIGRATION)
      }
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

  // 3b. dependencies the app ships itself rather than in plugins/ — dshmarket. The profile
  //     resolves packages by name, so without a link here the harness logs
  //     "dsh-market (dshmarket): failed to import" and the card never renders: it can be
  //     neither installed nor removed, which reads as the market being broken. Linking the
  //     shipped copy is enough — Node resolves the package's own requires from its real
  //     path, so its transitive dependencies come along.
  const shippedModules = join(resourcesPath, 'node_modules')
  if (existsSync(manifest) && existsSync(shippedModules)) {
    try {
      const d = JSON.parse(readFileSync(manifest, 'utf8'))
      for (const name of Object.keys(d.dependencies || {})) {
        const target = join(modules, name)
        if (existsSync(target) || isLink(target)) continue
        const shipped = join(shippedModules, name)
        if (!existsSync(shipped)) continue
        try {
          symlinkSync(shipped, target, 'dir')
          linked++
          log(`[seed] linked shipped dependency ${name}`)
        } catch (e) {
          log(`[seed] could not link ${name}: ${e.message}`)
        }
      }
    } catch (e) {
      log(`[seed] could not read the manifest to link dependencies: ${e.message}`)
    }
  }

  if (fresh || linked) log(`[seed] ${fresh ? 'new' : 'existing'} profile, ${linked} plugin(s) linked`)
  return { fresh, linked, profile: web }
}

function isLink(p) {
  try { return lstatSync(p).isSymbolicLink() } catch { return false }
}

// Entries an older build pinned, and which therefore cannot be edited from the UI. Removed
// by a one-shot migration rather than on every boot: the plugins write these same ids
// themselves, so an unconditional strip would delete providers the user adds.
const STALE_PINS = ['llm-pi-ai', 'dsh-market']
const UNPIN_MIGRATION = 'unpin-pinned-provider-entries'

/** Migration ids already applied for this profile, recorded beside it. */
function appliedMigrations(dshHome) {
  try {
    const d = JSON.parse(readFileSync(join(dshHome, MIGRATIONS_FILE), 'utf8'))
    return new Set(Array.isArray(d?.applied) ? d.applied : [])
  } catch {
    return new Set()
  }
}

function recordMigration(dshHome, id) {
  try {
    const applied = appliedMigrations(dshHome)
    applied.add(id)
    writeFileSync(join(dshHome, MIGRATIONS_FILE), JSON.stringify({ applied: [...applied] }, null, 2) + '\n')
  } catch (e) {
    // not fatal: the worst case is the migration runs again and strips a stale entry twice
  }
}

/**
 * Remove top-level `- id: <name>` blocks for the given ids, along with the comment lines
 * immediately above them. The file is a hand-written overlay, so this walks lines rather
 * than parsing YAML: an indented body ends at the next line that starts at column 0.
 */
function stripPinnedBlocks(yaml, ids) {
  const out = []
  let pending = []
  let skip = false
  for (const line of yaml.split('\n')) {
    if (/^-\s/.test(line)) skip = false
    const m = /^- id:\s*(\S+)\s*$/.exec(line)
    if (m && ids.includes(m[1])) {
      skip = true
      pending = []
      continue
    }
    if (skip && (/^\s+\S/.test(line) || line.trim() === '')) continue
    skip = false
    if (line.startsWith('#')) {
      pending.push(line)
      continue
    }
    out.push(...pending, line)
    pending = []
  }
  out.push(...pending)
  return out.join('\n')
}

function fileHasBundles(p) {
  try {
    const d = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(d?.dsh?.profile?.bundles) && d.dsh.profile.bundles.length > 0
  } catch { return false }
}
