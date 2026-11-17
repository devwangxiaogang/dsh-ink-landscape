/**
 * 在真实 shell 里做一次「有交互」的体检：先预置皮肤，再执行一段动作表达式
 * （比如点开左下角账户弹框），然后截图 + 回显可疑元素的底色。
 *
 *   node tools/probe-overlay.mjs <url> <out.png> <ink|galaxy|default> [light|dark] "<action js>" [waitMs]
 *
 * 回显的重点是「浅色 scheme 下不该发白的地方」：面积够大、背景接近白色、
 * 又不是 body/html 的元素，一律列出来（含 border / box-shadow / backdrop）。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const [url, outArg, family = 'galaxy', scheme = 'light', action = 'true', waitArg = '9000'] = process.argv.slice(2)
if (!url || !outArg) {
  console.error('usage: node tools/probe-overlay.mjs <url> <out.png> [ink|galaxy|default] [light|dark] "<action js>" [waitMs]')
  process.exit(2)
}
const wait = Number(waitArg)
const out = resolve(root, outArg)
const shotRoot = resolve(root, '.shots')
mkdirSync(dirname(out), { recursive: true })
mkdirSync(shotRoot, { recursive: true })

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profileDir = join(shotRoot, `.cdp-overlay-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })
const port = 9600 + Math.floor(Math.random() * 300)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const REPORT = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(',').map((v) => parseFloat(v))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect()
    if (rect.width * rect.height < 3000) continue
    if (rect.bottom < 0 || rect.top > innerHeight) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue
    const bg = parse(cs.backgroundColor)
    if (!bg || bg.a < 0.15) continue
    const lum = (bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114)
    if (lum < 150) continue
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 70),
      role: el.getAttribute('role') || '',
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      bg: cs.backgroundColor,
      border: cs.borderTopColor + ' ' + cs.borderTopWidth,
      shadow: cs.boxShadow.slice(0, 60),
      backdrop: cs.backdropFilter,
      z: cs.zIndex,
    })
  }
  out.sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])
  const rootStyle = getComputedStyle(document.body)
  const tokens = {}
  for (const name of ['--dsw-alias-bg-overlay','--dsw-alias-bg-layer-1','--dsw-alias-bg-layer-2','--dsw-alias-bg-layer-3','--dsw-alias-bg-layer-4','--dsw-specific-menu','--dsw-alias-hovercard-bg','--dsw-alias-hovercard-border','--dsw-specific-sidebar-fill','--dsw-specific-sidebar-tint','--dsw-specific-sidebar-glass-fill','--dsw-specific-sidebar-wash-top','--dsw-specific-sidebar-wash-bottom','--dsw-alias-bg-base','--dsw-alias-bg-top','--dsw-elevation-stroke-color']) {
    tokens[name] = rootStyle.getPropertyValue(name).trim()
  }
  return JSON.stringify({ count: out.length, whiteish: out.slice(0, 10), tokens, skin: document.documentElement.dataset.inkSkin, tone: document.documentElement.dataset.inkTone }, null, 1)
})()`

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

  await send('Page.navigate', { url })
  await sleep(4500)
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('dsh-ink-landscape:skin', ${JSON.stringify(family)});
      localStorage.setItem('dsh-ink-landscape:enabled', ${JSON.stringify(family === 'default' ? 'off' : 'on')});
      true`,
  })
  await send('Page.reload', { ignoreCache: false })
  await sleep(wait)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const hit = [...document.querySelectorAll('button')].find((b) => ['继续', '知道了', '跳过'].includes((b.textContent || '').trim()))
      if (hit) hit.click()
      return true
    })()`,
  })
  await sleep(500)

  const acted = await send('Runtime.evaluate', { expression: `(() => { ${action} })()`, awaitPromise: true })
  const label = acted.result?.result?.value
  if (label) console.log('action:', typeof label === 'string' ? label : JSON.stringify(label))
  await sleep(900)

  const report = await send('Runtime.evaluate', { expression: REPORT, returnByValue: true })
  const value = report.result?.result?.value
  console.log(typeof value === 'string' ? value : JSON.stringify(value ?? report, null, 1))

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
