//#region lib/types/index.js
/**
 * Tunnel settings page — host half.
 *
 * The page talks to the `dsh-remote` gateway's `/tunnel` endpoints, which own
 * the cloudflared connector (token file, launchd job, log), so no host
 * behaviour is needed here: the plugin is mounted for its client face only.
 */
function apply() {}
//#endregion
export { apply };
