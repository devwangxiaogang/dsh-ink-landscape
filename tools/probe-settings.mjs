/**
 * Probe the real shell's 设置 page: what actually paints behind the content,
 * which stable hooks exist, and how transparent it ends up.
 *
 *   node tools/probe-settings.mjs "<url>"
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('usage: node tools/probe-settings.mjs <url>')
  process.exit(2)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profileDir = resolve(`.shots/.settings-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const port = 9600 + Math.floor(Math.random() * 300)

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${port}`,
  'about:blank',
])

const EXPR = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // The settings entry lives in the sidebar's own slot; clicking the slot's
  // interactive descendant is the stable way in (no text matching needed).
  const launcher = document.querySelector('[data-slot="settings.launcher"]')
  const clickable = launcher?.querySelector('button, [role="button"], a') ?? launcher
  if (clickable) clickable.click()
  await sleep(1500)
  // If that only opened a menu, prefer an entry whose text is 设置.
  if (!document.querySelector('[data-slot="settings.section"], [role="dialog"], dialog')) {
    const item = [...document.querySelectorAll('button, [role="menuitem"], [role="button"]')]
      .find((el) => (el.textContent || '').trim().startsWith('设置'))
    if (item) item.click()
    await sleep(1200)
  }
  // Optional: open a section by its label (e.g. 通用设置) before measuring.
  const wanted = __SECTION__
  if (wanted) {
    const tab = [...document.querySelectorAll('button, [role="tab"], [role="button"], li, div')]
      .find((el) => (el.textContent || '').trim() === wanted)
    if (tab) { tab.click(); await sleep(900) }
  }
  const layer = document.elementFromPoint(Math.round(innerWidth * 0.5), Math.round(innerHeight * 0.85))
  const big = [...document.querySelectorAll('*')].filter((el) => {
    const r = el.getBoundingClientRect()
    if (r.width < innerWidth * 0.5 || r.height < innerHeight * 0.4) return false
    const bg = getComputedStyle(el).backgroundColor
    return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
  }).slice(0, 14).map((el) => {
    const cs = getComputedStyle(el)
    const attrs = [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value)
    return {
      cls: (el.className || '').toString().slice(0, 40),
      bg: cs.backgroundColor,
      attrs: attrs.slice(0, 4),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      op: cs.opacity,
    }
  })
  const slots = [...new Set([...document.querySelectorAll('[data-slot]')].map((el) => el.dataset.slot))]
  const portals = [...document.querySelectorAll('[data-portal]')].map((el) => (el.dataset.portal || '?').slice(0, 40))
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog')].map((el) => ({
    cls: (el.className || '').toString().slice(0, 40),
    bg: getComputedStyle(el).backgroundColor,
  }))
  return JSON.stringify({
    at: layer ? ((layer.className || '') + '').toString().slice(0, 40) : null,
    big,
    slots,
    portals,
    dialogs,
    rootAttrs: [...document.documentElement.attributes].map((a) => a.name + '=' + a.value).slice(0, 8),
    inkRow: (() => {
      const row = document.querySelector('.ink-row')
      if (!row) return null
      const r = row.getBoundingClientRect()
      const cs = getComputedStyle(row)
      return { text: (row.textContent || '').slice(0, 40), visible: r.height > 0, y: Math.round(r.top), color: cs.color }
    })(),
  })
})()`

let ws
try {
  let endpoint
  for (let i = 0; i < 100; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) {
        endpoint = page.webSocketDebuggerUrl
        break
      }
    } catch {
      /* not up */
    }
    await sleep(150)
  }
  if (!endpoint) throw new Error('no CDP endpoint')
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
  const scheme = process.argv[3]
  if (scheme === 'light' || scheme === 'dark') {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
  }
  await send('Page.navigate', { url })
  await sleep(7000)
  const expr = EXPR.replace('__SECTION__', JSON.stringify(process.argv[4] ?? ''))
  const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  // Bring our row into view so the screenshot actually shows it.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const row = document.querySelector('.ink-row')
      if (row) row.scrollIntoView({ block: 'center' })
      return true
    })()`,
  })
  await sleep(900)
  console.log(res.result?.result?.value ?? JSON.stringify(res.result))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot.result?.data) {
    writeFileSync(`.shots/settings-real-${process.argv[3] ?? 'auto'}.png`, Buffer.from(shot.result.data, 'base64'))
    console.log('screenshot: .shots/settings-real-' + (process.argv[3] ?? 'auto') + '.png')
  }
} finally {
  try {
    ws?.close()
  } catch {
    /* ignore */
  }
  edge.kill()
  await sleep(600)
  for (let i = 0; i < 12; i += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true })
      break
    } catch {
      await sleep(250)
    }
  }
}
