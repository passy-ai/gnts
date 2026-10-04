/** Packaging. Two targets: macOS (dmg) and Windows (nsis), matching what we ship. */
export default {
  appId: 'dev.gnts.desktop',
  productName: 'gnts.dev',
  directories: { output: 'dist', buildResources: 'resources' },
  files: ['src/**/*', 'package.json'],
  // The Node entry and the patch layer are read at runtime by path, so they must
  // sit in Resources rather than inside the asar.
  extraResources: [
    'resources/harness-node-entry.mjs',
    'resources/host-module-fallback.mjs',
    'resources/gnts.patch.yml',
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
