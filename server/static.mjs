import fs from 'node:fs'
import path from 'node:path'

/* ==========================================================================
   Serving the built app.

   The gateway serves the SPA on App Service, so this is a web root exposed to
   the internet and the containment check is the whole job: a request may not
   read a file outside dist. Anything that is not a real file inside it falls
   back to index.html, so a deep link still boots the app.

   It lives in its own module so the containment rule can be tested without
   starting a server.
   ========================================================================== */

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Where a request lands inside the web root, and whether it escaped.
 *
 * Containment is checked against the root plus a separator, not the root
 * alone: `startsWith(dist)` would also accept a sibling directory whose name
 * merely begins with it, so a request for `/../dist-backup/x` resolving to
 * `…/dist-backup/x` would pass a prefix test while sitting outside the root.
 *
 * `exists` is reported separately from `inside` so a caller can tell a request
 * that escaped from one that simply asked for a file that is not there. Both
 * end up at index.html; only one of them is worth noticing.
 */
export function resolveStatic(dist, url, exists = (p) => fs.existsSync(p) && fs.statSync(p).isFile()) {
  const index = path.join(dist, 'index.html')
  const raw = ((url ?? '').split('?')[0].split('#')[0] || '/').replace(/\/+$/, '') || '/'

  // Decoded before resolving, so an encoded separator cannot smuggle a path
  // segment past the check — `/..%2fsecret` has to become `/../secret` and be
  // caught, rather than be taken for a file with a curious name. Containment
  // is still decided after resolving, which is what makes decoding safe.
  let clean
  try {
    clean = decodeURIComponent(raw)
  } catch {
    return { target: index, inside: true, found: false, fellBack: true, malformed: true }
  }

  const candidate = path.resolve(dist, '.' + (clean === '/' ? '/index.html' : clean))
  const inside = candidate === index || candidate.startsWith(dist + path.sep)
  const found = inside && exists(candidate)
  return { target: found ? candidate : index, inside, found, fellBack: !found, malformed: false }
}

export const mimeFor = (target) => MIME[path.extname(target)] ?? 'application/octet-stream'

/** Assets are content-hashed by the build, so they may be cached forever. */
export const isImmutable = (target) => target.includes(`${path.sep}assets${path.sep}`)
