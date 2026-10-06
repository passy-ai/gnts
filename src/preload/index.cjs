/**
 * The bridges. Kept deliberately small: Harness's web UI does the work, and each
 * bridge here is a capability the browser cannot provide on its own.
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Harness's client switches on its native macOS layout from this marker, and it
 * reads it as it mounts — so it has to be set before any page script runs.
 */
function markPlatform() {
  const root = document.documentElement
  if (!root) return
  if (process.platform === 'darwin') root.dataset.platform = 'darwin'
  // The desktop window is not the browser on the same port. Our client plugins need to
  // tell them apart — the app keeps white sidebar text while the browser follows its
  // own theme — and this is the only marker that exists in the app and nowhere else.
  root.classList.add('gn-desktop-window')
  // Setting data-platform above makes dsh-client-shortcuts conclude it is in a
  // desktop host, where it then demands a native keyboard bridge we do not
  // have. This marker keeps it on the browser keyboard adapter while still
  // reporting the platform, which is what makes the native macOS layout work.
  root.dataset.gntsWebShortcuts = 'true'
}

markPlatform()
document.addEventListener('DOMContentLoaded', markPlatform, { once: true })

/**
 * The native directory picker. Harness's `host-directory-picker-auto` keeps the
 * stock picker row active when a native backend is present, so exposing this is
 * what makes "add a workspace folder" use the real macOS/Windows dialog.
 */
contextBridge.exposeInMainWorld('__DSH_DIRECTORY_PICKER__', {
  pick: () => ipcRenderer.invoke('gnts:pick-directory'),
})
