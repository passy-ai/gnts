//#region lib/types/index.js
/**
 * Pairing settings page — host half.
 *
 * Everything this page does happens over the browser's own session: it POSTs to
 * the `dsh-remote` gateway's `/devices/newcode` (which mints the one-time code
 * and records it under `codes/`), so no host behaviour is needed here. The
 * plugin is mounted for its client face only.
 */
function apply() {}
//#endregion
export { apply };
