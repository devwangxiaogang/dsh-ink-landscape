/**
 * Screenshot a page through CDP (real time, not virtual time).
 *
 * `msedge --headless=new --screenshot` captures too early for CSS transitions
 * and idle-time work, and it hangs forever on the live shell because the client
 * HMR stream keeps the page busy. Driving Page.captureScreenshot over the
 * DevTools protocol waits in real time instead.
 *
 *   node tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [light|dark]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const [, , url, out, waitArg, widthArg, heightArg, schemeArg] = process.argv
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [light|dark]')
  process.exit(2)
}

const waitMs = Number(waitArg ?? 2500)
const width = Number(widthArg ?? 1680)
const height = Number(heightArg ?? 1000)
const scheme = schemeArg === 'dark' ? 'dark' : schemeArg === 'light' ? 'light' : undefined
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const root = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), '..')
const profileDir = resolve(`.shots/.shot-${Date.now()}-${process.pid}`)
mkdirSync(profileDir, { recursive: true })
mkdirSync(dirname(resolve(out)), { recursive: true })

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const port = 9500 + Math.floor(Math.random() * 400)

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${port}`,
  'about:blank',
])

let ws
try {
  let endpoint
  for (let i = 0; i < 100; i += 1) {
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
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (scheme) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: scheme }],
    })
  }
  await send('Page.navigate', { url })
  await sleep(waitMs)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (!shot.result?.data) throw new Error(`capture failed: ${JSON.stringify(shot.error ?? shot)}`)
  writeFileSync(resolve(out), Buffer.from(shot.result.data, 'base64'))
  console.log(`captured ${out}`)
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
