#!/usr/bin/env node
/**
 * Turn a built dist/ into a feed directory.
 *
 *   node scripts/make-feed.mjs            # writes feed/ from the newest zip in dist/
 *
 * `provider: generic` is a static directory, so this is the whole "release
 * pipeline": copy the zip in and write the metadata that names it.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const dist = join(root, 'dist')
const feed = join(root, 'feed')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

if (!existsSync(dist)) { console.error('make-feed: no dist/ — run package:mac first'); process.exit(1) }
const zip = readdirSync(dist).filter((f) => f.endsWith('.zip')).sort().pop()
if (!zip) { console.error('make-feed: no .zip in dist/ — electron-builder writes one for mac targets'); process.exit(1) }

mkdirSync(feed, { recursive: true })
copyFileSync(join(dist, zip), join(feed, zip))
const bytes = statSync(join(feed, zip)).size
const sha512 = createHash('sha512').update(readFileSync(join(feed, zip))).digest('base64')

writeFileSync(join(feed, 'latest-mac.yml'), [
  `version: ${version}`,
  'files:',
  `  - url: ${zip}`,
  `    sha512: ${sha512}`,
  `    size: ${bytes}`,
  `path: ${zip}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n'))
console.log(`make-feed: ${version} → feed/${basename(zip)} (${(bytes / 1e6).toFixed(0)} MB)`)
console.log(`serve it:  (cd feed && python3 -m http.server 8099)`)
console.log(`point at it: GNTS_UPDATE_FEED=http://127.0.0.1:8099 npm start`)
