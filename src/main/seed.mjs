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
          log(`[seed] removed stale pinned entries from the patch — a pinned entry cannot be edited`)
        }
        recordMigration(dshHome, UNPIN_MIGRATION)
      }

      // The same one-shot treatment for the other half of the duplicate-entry bug: our
      // packages are in the profile's bundle list, which is what mounts them, so an
      // `insert:` block naming them registered every one of them twice. The boot tolerated
      // it; dshmarket's trial validation did not, so every update reported the composition
      // as unable to boot and rolled back.
      if (existsSync(patch) && !appliedMigrations(dshHome).has(DEDUPE_MIGRATION)) {
        const current = readFileSync(patch, 'utf8')
        const cleaned = stripDuplicateInserts(current, bundleNames(manifest))
        if (cleaned !== current) {
          writeFileSync(patch, cleaned)
          log(`[seed] dropped an insert block for packages already in the bundle list — they were registered twice`)
        }
        recordMigration(dshHome, DEDUPE_MIGRATION)
      }

      // One more invariant, because dshmarket also writes this file: an entry id may appear
      // once. Two rows with the same id are what its trial validation refuses, and it is the
      // shape a bad update leaves behind. The first row wins; the rest are dropped.
      if (existsSync(patch) && !appliedMigrations(dshHome).has(UNIQUE_IDS_MIGRATION)) {
        const current = readFileSync(patch, 'utf8')
        const cleaned = stripDuplicateEntryIds(current)
        if (cleaned !== current) {
          writeFileSync(patch, cleaned)
          log(`[seed] dropped duplicate entry ids from the patch — an id may appear once`)
        }
        recordMigration(dshHome, UNIQUE_IDS_MIGRATION)
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

/**
 * Keep only the first top-level `- id: <name>` block for each id. Duplicate ids are what
 * dshmarket's trial validation refuses, and a file both we and it write can end up with
 * them. The first occurrence wins, so a hand-written entry is never replaced by a later one.
 */
function stripDuplicateEntryIds(yaml) {
  const lines = yaml.split('\n')
  const out = []
  const seen = new Set()
  let i = 0
  while (i < lines.length) {
    const m = /^- id:\s*(\S+)\s*$/.exec(lines[i])
    if (m !== null) {
      let j = i + 1
      const body = [lines[i]]
      while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) {
        body.push(lines[j])
        j++
      }
      if (seen.has(m[1])) {
        i = j
        continue
      }
      seen.add(m[1])
      out.push(...body)
      i = j
      continue
    }
    out.push(lines[i])
    i++
  }
  return out.join('\n')
}

/** The profile's bundle list: the packages the loader mounts by name. */
function bundleNames(manifestPath) {
  try {
    const d = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return new Set(d?.dsh?.profile?.bundles ?? [])
  } catch {
    return new Set()
  }
}

/**
 * Drop any top-level `insert:` block whose entries are all already in the profile's bundle
 * list. Those entries are mounted by the bundle list, so inserting them as well registers
 * each id twice. The rule is "already a bundle", not a list of our names: any block that
 * duplicates the bundle list is wrong for the same reason.
 */
function stripDuplicateInserts(yaml, bundles) {
  if (bundles.size === 0) return yaml
  const lines = yaml.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    if (/^- insert:\s*$/.test(lines[i])) {
      let j = i + 1
      const body = []
      while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) {
        body.push(lines[j])
        j++
      }
      const ids = body
        .map((line) => /^\s+- id:\s*(\S+)\s*$/.exec(line))
        .filter((m) => m !== null)
        .map((m) => m[1])
      if (ids.length > 0 && ids.every((id) => bundles.has(id))) {
        i = j
        continue
      }
    }
    out.push(lines[i])
    i++
  }
  return out.join('\n')
}

// Entries an older build pinned, and which therefore cannot be edited from the UI. Removed
// by a one-shot migration rather than on every boot: the plugins write these same ids
// themselves, so an unconditional strip would delete providers the user adds.
//
// Each matcher sees the whole block. `llm-pi-ai` is matched narrowly — only the stale empty
// provider an old build wrote, which pointed at our own gateway and could not be removed —
// because that id now holds the user's real providers and stripping one would be data loss.
const STALE_PINS = {
  'llm-pi-ai': (block) => block.indexOf('127.0.0.1:8080') !== -1 && /models:\s*\[\]/.test(block),
  'dsh-market': () => true,
}
const UNPIN_MIGRATION = 'unpin-pinned-provider-entries'
const DEDUPE_MIGRATION = 'drop-insert-blocks-already-in-the-bundle-list'
const UNIQUE_IDS_MIGRATION = 'drop-duplicate-entry-ids'

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
 * Remove top-level `- id: <name>` blocks whose matcher accepts them, along with the comment
 * lines immediately above. The file is a hand-written overlay, so this walks lines rather
 * than parsing YAML: an indented body ends at the next line that starts at column 0.
 */
function stripPinnedBlocks(yaml, matchers) {
  const lines = yaml.split('\n')
  const out = []
  let comments = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('#')) {
      comments.push(line)
      i++
      continue
    }
    const m = /^- id:\s*(\S+)\s*$/.exec(line)
    if (m !== null && matchers[m[1]] !== undefined) {
      let j = i + 1
      const body = [line]
      while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) {
        body.push(lines[j])
        j++
      }
      if (matchers[m[1]](body.join('\n'))) {
        comments = []
        i = j
        continue
      }
    }
    out.push(...comments, line)
    comments = []
    i++
  }
  out.push(...comments)
  return out.join('\n')
}

function fileHasBundles(p) {
  try {
    const d = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(d?.dsh?.profile?.bundles) && d.dsh.profile.bundles.length > 0
  } catch { return false }
}
