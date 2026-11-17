/**
 * Node half of `dsh-ink-landscape`.
 *
 * The skin is a browser-side plugin: everything — the two themes, the landscape
 * scene, the 印章 brand mark, the settings row — lives in `./client.js`, which
 * client-modules mounts on this loader row. This Node half exists so the row has
 * a real module to import; it deliberately imports nothing else, because the
 * package sits outside the DSH installation's `node_modules` tree.
 *
 * @module dsh-ink-landscape
 */

/** Cordis plugin name; matches the loader row's `name`. */
export const name = 'dsh-ink-landscape'

/** No host services are required — the browser half declares its own. */
export const inject = []

/**
 * Nothing to do on the host: the skin is composed in the browser from
 * `exports["./client"]`. Row config (`autoApply`, `motion`) is read by the row
 * itself and surfaced in the web settings row.
 *
 * @param _ctx - Cordis context for this loader row.
 * @param _config - Resolved row config.
 */
export function apply(_ctx, _config = {}) {}
