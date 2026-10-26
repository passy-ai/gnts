# The gnts.dev plugin collection

The app in `src/`, and every plugin its profile mounts, with the consolidated
composition in `cordis.patch.yml` — one checkout, one source of truth.

**This directory is the source of truth.** The build packages it into the app's
`Resources/plugins`, and the app seeds its profile from there, so editing a plugin here and
rebuilding is all it takes. `GNTS_PLUGINS_DIR` overrides it if you want to run against a
different tree. There is no second copy to keep in step.

## What is here

| package | role |
| --- | --- |
| `gnts-sidebar`, `gnts-sidebar-shell` | the sidebar frame and wordmark |
| `gnts-settings` | the settings shell and nav |
| `gnts-autodiscover` | the only way to add a provider, plus the opening card |
| `gnts-glass` | the glass chat switch, dark mode only |
| `gnts-brand` | wordmark, boot-cover lift, badge hiding |
| `dsh-model-default` | "Add Model" in the composer, and blocks Send until one is |
| `gnts-plugins` | the Plugins page |
| `gnts-folders`, `gnts-model-search` | optional |
| `gnts-pairing`, `gnts-tunnel` | optional: pairing and remote access |

`dshmarket` is shipped as a dependency and offered in the Plugins page's Official group.
