/**
 * Screenshot the real shell with a chosen skin already selected.
 *
 * localStorage is origin-scoped, so the value has to be written *inside* the
 * page: load once, seed the key, reload, then capture.
 *
 *   node tools/shot-skin.mjs <url> <out.png> <ink|galaxy|default> [light|dark] [waitMs]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const [url, outArg, family = 'ink', scheme = 'light', waitArg = '9000'] = process.argv.slice(2)
if (!url || !outArg) {
  console.error('usage: node tools/shot-skin.mjs <url> <out.png> [ink|galaxy|default] [light|dark] [waitMs]')
  process.exit(2)
}
const wait = Number(waitArg)
const out = resolve(root, outArg)
const shotRoot = resolve(root, '.shots')
mkdirSync(dirname(out), { recursive: true })
mkdirSync(shotRoot, { recursive: true })

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profileDir = join(shotRoot, `.cdp-skin-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })
const port = 9500 + Math.floor(Math.random() * 300)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${port}`,
  '--window-size=1680,1000',
  'about:blank',
])

let ws
try {
  let endpoint
  for (let i = 0; i < 120; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const target = list.find((t) => t.type === 'page')
      if (target?.webSocketDebuggerUrl) {
        endpoint = target.webSocketDebuggerUrl
        break
      }
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  if (!endpoint) throw new Error('CDP endpoint never appeared')

  ws = new WebSocket(endpoint)
  await new Promise((done, fail) => {
    ws.addEventListener('open', done, { once: true })
    ws.addEventListener('error', fail, { once: true })
  })

  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((done) => {
      const id = ++seq
      pending.set(id, done)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })

  // 1st load: gives us the origin so localStorage is writable, and lets any
  // one-time dialogs settle.
  await send('Page.navigate', { url })
  await sleep(4500)
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('dsh-ink-landscape:skin', ${JSON.stringify(family)});
      localStorage.setItem('dsh-ink-landscape:enabled', ${JSON.stringify(family === 'default' ? 'off' : 'on')});
      true`,
  })
  await send('Page.reload', { ignoreCache: false })
  await sleep(wait)
  // Nudge the 预览版说明 dialog if it is still up.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const hit = [...document.querySelectorAll('button')].find((b) => ['继续', '知道了', '跳过'].includes((b.textContent || '').trim()))
      if (hit) hit.click()
      return true
    })()`,
  })
  await sleep(600)

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!shot.result?.data) throw new Error(`capture failed: ${JSON.stringify(shot.error ?? shot)}`)
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`captured ${outArg} (${family}/${scheme})`)
} finally {
  try {
    ws?.close()
  } catch {
    /* ignore */
  }
  edge.kill()
  await sleep(700)
  for (let i = 0; i < 12; i += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true })
      break
    } catch {
      await sleep(250)
    }
  }
}
