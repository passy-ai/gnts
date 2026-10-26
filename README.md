# gnts

A desktop shell for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

gnts does not fork the harness. It depends on the published `@deepseek-ai/dsh` packages, spawns
them on a port it reserves, and shows their web UI in a window — then layers its own plugins on
top: a sidebar and wordmark, a settings shell, Autodiscover for model providers, the model seat in
the composer, and a boot cover that keeps the window branded while the harness starts.

```
src/main/harness.mjs     spawn the harness, reserve its port, wait until it serves
src/main/index.mjs       app lifecycle, one window, the directory-picker IPC
src/main/paths.mjs       DSH_HOME, the profile, logs, harness entry resolution
src/preload/index.cjs    the bridges (platform marker, native directory picker)
resources/               the Node entry, the module fallback, the patch layer, the boot cover
plugins/                 the plugins the profile mounts — the source of truth
```

Plain JavaScript, ESM, no bundler and no TypeScript: Electron runs the source directly, so there
is no build step that can drift from what ships.

## Install

Download the `.dmg` for your Mac from [Releases](../../releases):

| file | machine |
| --- | --- |
| `gnts-<version>-arm64.dmg` | Apple silicon |
| `gnts-<version>-x64.dmg` | Intel |

The builds are **not code-signed or notarized**, so the first launch has to get past Gatekeeper:
right-click the app → **Open**, or allow it under **System Settings → Privacy & Security**.

gnts ships no model credentials. On first run, add a provider through **Autodiscover** in the
composer, or paste a key from any OpenAI-compatible provider.

## Run from source

```sh
npm install
npm start
```

`npm install` also applies the patches in `patches/` through `patch-package`. To run against a
different harness build instead of the pinned dependency:

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
  sessions/                  conversations
  settings.yaml
<logs>/harness.log           harness and desktop diagnostics
```

On macOS that is `~/Library/Application Support/gnts.dev/harness` and
`~/Library/Logs/gnts.dev/harness.log`. Nothing outside those two directories is written.

## Plugins

`plugins/` is the source of truth. The build copies it into the app's `Resources/plugins`, and on
first run the app seeds the harness profile from there, symlinking each plugin into
`profiles/web/node_modules` — so editing a plugin and rebuilding is all it takes.
[`plugins/README.md`](plugins/README.md) lists what each one does.

Every plugin ships its own `cordis.patch.yml`, which is what mounts it; the consolidated view is
`plugins/cordis.patch.yml`.
