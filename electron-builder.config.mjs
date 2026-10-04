/** Packaging. Two targets: macOS (dmg) and Windows (nsis), matching what we ship. */
export default {
  appId: 'dev.gnts.desktop',
  productName: 'gnts.dev',
  directories: { output: 'dist', buildResources: 'resources' },
  files: ['src/**/*', 'package.json'],
  // The Node entry and the patch layer are read at runtime by path, so they must
  // sit in Resources rather than inside the asar.
  // Explicit from/to: a bare path would keep the `resources/` prefix and land
  // these one level too deep, where the runtime cannot find them.
  extraResources: [
    { from: 'resources/harness-node-entry.mjs', to: 'harness-node-entry.mjs' },
    { from: 'resources/host-module-fallback.mjs', to: 'host-module-fallback.mjs' },
    { from: 'resources/gnts.patch.yml', to: 'gnts.patch.yml' },
    { from: 'resources/gateway.cjs', to: 'gateway.cjs' },
  ],
  asar: true,
  npmRebuild: false,
  mac: {
    category: 'public.app-category.developer-tools',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
}
