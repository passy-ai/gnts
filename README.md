# gnts.dev

Our desktop layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

We do not fork the harness. We depend on the published `@deepseek-ai/dsh` packages, spawn them, and
show their web UI in a window — then add our own plugins. Same approach as
[`dataelement/dsh-desktop`](https://github.com/dataelement/dsh-desktop), with our taste and a
fraction of the code.

See **[PLAN.md](PLAN.md)** for the investigation behind this and what we deliberately left out.

## What is here

```
src/main/harness.mjs     spawn Harness, reserve its port, wait until it serves   ← the core
src/main/index.mjs       app lifecycle, one window, the directory-picker IPC
src/main/paths.mjs       DSH_HOME, profile, logs, harness entry resolution
src/preload/index.cjs    the bridges (platform marker, native directory picker)
resources/               the Node entry, the module fallback, our patch layer
```

Plain JavaScript, ESM, no bundler and no TypeScript: Electron runs the source directly, so there is
no build step to break.

## Run it

```sh
npm install
npm start
```

The window shows a stock Harness from our own pinned `@deepseek-ai/dsh`. To run against another
installation instead — the CLI kit's, or a checkout — point at its entry:

```sh
GNTS_DSH_ENTRY=/path/to/@deepseek-ai/dsh/lib/bin.js npm start
```

## Package

```sh
npm run package:mac      # dmg, arm64 + x64
npm run package:win      # nsis, x64
npm run package:dir      # unpacked, for testing
```

## Where things live at runtime

```
<userData>/harness/          DSH_HOME
  profiles/web/              package.json + cordis.patch.yml
  sessions/  settings.yaml
<logs>/harness.log           Harness and desktop diagnostics
```

## Adding a plugin

Our plugins live in `~/.local/dsh-plugins` and are installed into the profile, one at a time:

```sh
dsh plugin --profile web add ~/.local/dsh-plugins/<plugin>
```

Each plugin ships its own `cordis.patch.yml` and declares it in `dsh.bundle.patch`, so installing is
all it takes — the profile carries no hand-written mount rows.

Before writing one, read `docs/patch-plugin-contract.md` in the reference clone at
`~/Projects/dsh-desktop`: slots and your own roots, scoped CSS, no broad global selectors, and no
DOM surgery on nodes you do not own.
