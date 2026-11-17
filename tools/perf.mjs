/**
 * Measure what the skin costs at startup and while idle.
 *
 *   node tools/perf.mjs <url> [waitMs]
 *
 * Prints, for one page load:
 *   - boot timings (navigation → ink scene present → first animation frame)
 *   - Chromium performance metrics (script / style / layout / task totals)
 *   - the idle cost over 3 s (does the skin keep the compositor busy?)
 *   - long tasks observed by PerformanceObserver
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , url, waitMsArg] = process.argv
if (!url) {
  console.error('usage: node tools/perf.mjs <url> [waitMs]')
  process.exit(2)
}
const waitMs = Number(waitMsArg ?? 9000)

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9600 + (process.pid % 300)
const profileDir = resolve(`.perf-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  'about:blank',
])

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function endpoint() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
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

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return res.result?.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await send('Performance.enable')

// Instrument before the app boots: long tasks + when our scene shows up.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__PERF__ = { longTasks: [], marks: {} };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__PERF__.longTasks.push(Math.round(entry.duration));
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
    if (location.search.includes('noskin')) {
      try { localStorage.setItem('dsh-ink-landscape:enabled', 'off') } catch {}
    } else {
      try { localStorage.removeItem('dsh-ink-landscape:enabled') } catch {}
    }
    const watchScene = () => {
      if (window.__PERF__.marks.scene) return;
      if (document.getElementById('dsh-ink-scene')) {
        window.__PERF__.marks.scene = Math.round(performance.now());
        return;
      }
      requestAnimationFrame(watchScene);
    };
    requestAnimationFrame(watchScene);
    addEventListener('DOMContentLoaded', () => { window.__PERF__.marks.domContentLoaded = Math.round(performance.now()) });
    addEventListener('load', () => { window.__PERF__.marks.load = Math.round(performance.now()) });
    requestAnimationFrame(() => { window.__PERF__.marks.firstRaf = Math.round(performance.now()) });`,
})

const started = Date.now()
await send('Page.navigate', { url })
await sleep(waitMs)

const boot = await evaluate(`JSON.stringify(window.__PERF__ || {})`)
const metricsA = await evaluate(`(async () => {
  const list = await new Promise((done) => performance.getEntriesByType ? done([]) : done([]));
  return JSON.stringify({});
})()`)

const readMetrics = async () => {
  const res = await send('Performance.getMetrics')
  const out = {}
  for (const metric of res.result?.metrics ?? []) out[metric.name] = metric.value
  return out
}

const m1 = await readMetrics()
await sleep(3000)
const m2 = await readMetrics()

const delta = {}
for (const key of Object.keys(m2)) {
  if (typeof m2[key] === 'number' && typeof m1[key] === 'number') delta[key] = +(m2[key] - m1[key]).toFixed(4)
}

const interesting = [
  'TaskDuration',
  'ScriptDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
  'LayoutCount',
  'RecalcStyleCount',
  'JSHeapUsedSize',
  'Nodes',
  'Documents',
]
const pick = (source) => Object.fromEntries(interesting.filter((k) => k in source).map((k) => [k, source[k]]))

const sceneInfo = await evaluate(`JSON.stringify({
  scene: !!document.getElementById('dsh-ink-scene'),
  styleTags: document.querySelectorAll('style[data-plugin-css]').length,
  svgNodes: document.querySelectorAll('#dsh-ink-scene svg *').length,
  filters: document.querySelectorAll('#dsh-ink-scene filter').length,
  animated: document.querySelectorAll('#dsh-ink-scene [style*="animation-play-state"]').length,
  tokens: document.body.style.length,
})`)

const perfEntries = await evaluate(`JSON.stringify(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]))`)
const nav = await evaluate(`(async () => { const n = performance.getEntriesByType('navigation')[0]; return JSON.stringify({
  domInteractive: Math.round(n?.domInteractive ?? 0),
  domComplete: Math.round(n?.domComplete ?? 0),
  duration: Math.round(n?.duration ?? 0),
}); })()`)

console.log('boot marks :', boot)
console.log('paint      :', perfEntries)
console.log('navigation :', nav)
console.log('idle 3s Δ  :', JSON.stringify(pick(delta)))
console.log('absolute   :', JSON.stringify(pick(m2)))
console.log('scene      :', sceneInfo)
console.log('wall       :', Date.now() - started, 'ms')

ws.close()
edge.kill()
await sleep(600)
// Windows keeps the profile locked for a moment after the process exits.
for (let i = 0; i < 12; i += 1) {
  try {
    rmSync(profileDir, { recursive: true, force: true })
    break
  } catch {
    await sleep(250)
  }
}
