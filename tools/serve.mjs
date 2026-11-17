/**
 * Tiny static server for the offline preview pages.
 *
 * The bundle now addresses its artwork by the absolute URL the real shell
 * serves, `/plugins/dsh-ink-landscape/assets/<file>`, so a `file://` preview
 * cannot load it. This server reproduces that route on localhost:
 *
 *   /plugins/<pkg>/assets/<file>  →  lib/assets/<file>
 *   everything else               →  the package root (preview/, art/, …)
 *
 *   node tools/serve.mjs [port]
 */
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 54777)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
}

const ASSET_ROUTE = /^\/plugins\/(?:@[^/]+\/[^/]+|[^@/][^/]*)\/assets\/(.+)$/

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  const asset = ASSET_ROUTE.exec(url)
  const rel = asset ? join('lib/assets', normalize(asset[1])) : normalize(url).replace(/^([/\\])+/, '')
  const file = resolve(root, rel || 'preview/index.html')
  if (!file.startsWith(root)) {
    res.writeHead(403).end('forbidden')
    return
  }
  let info
  try {
    info = statSync(file)
    if (info.isDirectory()) throw new Error('dir')
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${url}`)
    return
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`preview: http://127.0.0.1:${port}/preview/index.html`)
})
