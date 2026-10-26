import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

/** Packaging. Two targets: macOS (dmg) and Windows (nsis), matching what we ship. */
export default {
  appId: 'dev.gnts',
  productName: 'gnts',
  directories: { output: 'dist', buildResources: 'resources' },
  // No `files` array on purpose. A `files` array REPLACES the default, and the
  // default is what walks the production dependency tree — listing globs instead
  // silently dropped transitive packages (cordis-plugin-group among them) and the
  // packaged app could not boot the harness.
  // The Node entry and the patch layer are read at runtime by path, so they must
  // sit in Resources rather than inside the asar.
  // Explicit from/to: a bare path would keep the `resources/` prefix and land
  // these one level too deep, where the runtime cannot find them.
  extraResources: [
    // The harness's dependency tree goes in Resources, NOT in the asar.
    // electron-builder packs only a package's DECLARED dependency tree, and the
    // harness leans on dozens of hoisted packages it never declares — 33 of them
    // 'failed to import' from an asar built that way. Copying node_modules
    // wholesale sidesteps the filter, and Node can import plain files directly.
    // node_modules ships wholesale, but not the .bin shims: they are relative symlinks
    // into each package, electron-builder tries to re-create them, and one broken
    // target aborts the whole build with ENOENT. Nothing at runtime invokes them —
    // the harness is loaded by path.
    { from: 'node_modules', to: 'node_modules', filter: ['**/*', '!**/.bin', '!**/.bin/**', '!**/.cache/**'] },
    { from: 'resources/harness-node-entry.mjs', to: 'harness-node-entry.mjs' },
    { from: 'resources/host-module-fallback.mjs', to: 'host-module-fallback.mjs' },
    { from: 'resources/gnts.patch.yml', to: 'gnts.patch.yml' },
    // The profile's bundle list. Shipped, not generated: it must keep the base bundles.
    { from: 'resources/gnts.profile.json', to: 'gnts.profile.json' },
    { from: 'resources/gateway.cjs', to: 'gateway.cjs' },
    // The boot cover, applied to the harness shell by the seed. The shell is inside
    // node_modules, so it is not in the repo and a fresh checkout would have no cover.
    { from: 'resources/shell', to: 'shell' },
    // Our plugins, taken from the repo rather than a working directory: one source of truth,
    // so a build cannot ship a plugin the committed tree does not have. Shipping them also
    // makes the dmg self-contained, because the app links its own copy
    // into the profile it seeds on first run.
    { from: 'plugins', to: 'plugins' },
  ],
  asar: true,
  npmRebuild: false,
  // An unsigned bundle whose inner binaries are linker-signed fails Gatekeeper's integrity
  // check, and macOS reports the copied app as damaged rather than unidentified. An ad-hoc
  // signature over the whole bundle fixes that: `codesign --verify --deep --strict` passes and
  // macOS falls back to the ordinary "unidentified developer" dialog, where right-click -> Open
  // works. (A Developer ID and notarization would remove the dialog entirely; this is the
  // honest minimum for a build nobody signs.)
  afterPack: async (context) => {
    if (context.electronPlatformName !== 'darwin') return
    const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  },
  mac: {
    // The icon we generated for the earlier setup: black field, white gnts.dev
    // wordmark in Geist, sharp corners.
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
  },
  win: {
    icon: 'build/icon.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
}
