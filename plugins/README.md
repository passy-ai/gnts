# The gnts.dev plugin collection

Copied here so one checkout holds everything: the app in `src/`, and every plugin the
profile mounts, with the consolidated composition in `cordis.patch.yml`.

**This copy is provenance, not a live link.** The running app reads its plugins from
`~/.local/dsh-plugins/plugins` (development) or from its own `Resources/plugins`
(packaged), and seeds the profile from the latter. Editing this directory alone changes
nothing at runtime — see `../docs/CONTEXT.md`.

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
| `gnts-folders`, `gnts-market`(removed), `gnts-model-search` | optional |
| `gnts-pairing`, `gnts-tunnel` | optional: pairing and remote access |
| `gnts-passy-wallet` | **disabled**, code kept — the zero-friction route |

`dshmarket` is shipped as a dependency and offered in the Plugins page's Official group.
