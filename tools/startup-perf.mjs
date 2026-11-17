/**
 * Startup cost probe for the real host: measures what the skin plugin adds to
 * boot — bundle download, style injection, scene mount, image decode, long tasks.
 *
 *   node tools/startup-perf.mjs <url> [skin] [scheme]
 *
 * Installs an observer *before* any app script runs, so each milestone is
 * timestamped from the app's own origin. Cache is disabled on the first run
 * (cold) and kept for the second (warm), which is exactly the two cases a user
 * feels: first launch after an update, and every restart after that.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , url, skin = 'galaxy', scheme = 'dark'] = process.argv
if (!url) {
  console.error('usage: node tools/startup-perf.mjs <url> [ink|galaxy|default] [light|dark]')
  process.exit(2)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const shotRoot = resolve('.shots')
mkdirSync(shotRoot, { recursive: true })
const profileDir = resolve(shotRoot, `.startup-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })
const port = 9700 + (process.pid % 200)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${port}`,
  'about:blank',
])

async function endpoint() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  throw new Error('CDP endpoint never appeared')
}

const ws = new WebSocket(await endpoint())
await new Promise((done) => ws.addEventListener('open', done, { once: true }))

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

/** Runs before the app bundle: timestamps every skin milestone in page time. */
const OBSERVER = `(() => {
  const boot = { marks: {}, longTasks: [] }
  window.__BOOT__ = boot
  const mark = (name, detail) => { if (boot.marks[name] === undefined) boot.marks[name] = Math.round(performance.now()) ; if (detail !== undefined) boot.marks[name + ':detail'] = detail }
  mark('observer')
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) boot.longTasks.push(Math.round(e.duration))
    }).observe({ entryTypes: ['longtask'] })
  } catch {}
  const watchStyles = () => {
    const seen = new Set()
    for (const tag of document.querySelectorAll('style[data-plugin="dsh-ink-landscape"]')) {
      const key = tag.dataset.pluginCss || 'style'
      if (seen.has(key)) continue
      seen.add(key)
      mark('style:' + key)
    }
  }
  const onNode = (node) => {
    if (node.id === 'dsh-ink-scene') mark('scene-mount')
    if (node.nodeType === 1) {
      watchStyles()
      if (node.matches?.('[data-ink-sidebar]')) mark('tag-sidebar')
      if (node.matches?.('[data-ink-header]')) mark('tag-header')
    }
  }
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) onNode(n)
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ink-sidebar', 'data-ink-header'] })
  addEventListener('DOMContentLoaded', () => { mark('dcl'); watchStyles() })
  addEventListener('load', () => mark('load'))
})()`

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER })

const PREP = `(() => {
  localStorage.setItem('dsh-ink-landscape:skin', ${JSON.stringify(skin)})
  localStorage.setItem('dsh-ink-landscape:scheme', ${JSON.stringify(scheme)})
})()`

const COLLECT = `(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {}
  const resources = performance.getEntriesByType('resource')
    .filter((r) => /plugins\\/dsh-ink-landscape|dsh-ink-landscape.*\\.js|assets\\//.test(r.name))
    .map((r) => ({
      file: r.name.split('/').slice(-2).join('/').replace(/\\?.*$/, ''),
      kind: r.initiatorType,
      start: Math.round(r.startTime),
      dur: Math.round(r.duration),
      kb: Math.round((r.encodedBodySize || 0) / 1024),
      decodedKb: Math.round((r.decodedBodySize || 0) / 1024),
    }))
  return {
    marks: window.__BOOT__?.marks ?? {},
    longTasks: window.__BOOT__?.longTasks ?? [],
    paint: performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]),
    domInteractive: Math.round(nav.domInteractive || 0),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    loadEnd: Math.round(nav.loadEventEnd || 0),
    resources,
    scene: (() => {
      const el = document.getElementById('dsh-ink-scene')
      if (!el) return null
      const cs = getComputedStyle(el)
      return { children: el.children.length, opacity: cs.opacity, display: cs.display }
    })(),
    styleTags: document.querySelectorAll('style[data-plugin="dsh-ink-landscape"]').length,
    assetImgs: performance.getEntriesByType('resource').filter((r) => /\\.webp$/.test(r.name)).length,
  }
})()`

async function run(label, disableCache) {
  await send('Network.setCacheDisabled', { cacheDisabled: disableCache })
  await send('Page.navigate', { url })
  await sleep(1600)
  await send('Runtime.evaluate', { expression: PREP })
  await send('Page.navigate', { url })
  await sleep(9000)
  const out = await send('Runtime.evaluate', { expression: COLLECT, returnByValue: true })
  console.log(`\n=== ${label} ===`)
  console.log(JSON.stringify(out.result?.result?.value ?? out.result, null, 2))
}

await run('cold (cache off)', true)
await run('warm (cache on)', false)

ws.close()
edge.kill()
await sleep(600)
try {
  rmSync(profileDir, { recursive: true, force: true })
} catch {}
