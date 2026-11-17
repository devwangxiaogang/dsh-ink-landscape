/**
 * Headless-Edge (CDP) probe for a local page: navigates, waits, then evaluates
 * an expression and prints its JSON value plus every console message and
 * uncaught exception the page produced.
 *
 *   node tools/probe-file.mjs <url> "<js expression>" [waitMs]
 *
 * Used for preview pages (`file://`) where the real host's probe does not apply.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , url, expression = 'document.title', waitMs = '1500'] = process.argv
if (!url) {
  console.error('usage: node tools/probe-file.mjs <url> "<js expression>" [waitMs]')
  process.exit(2)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9500 + (process.pid % 400)
const profileDir = resolve(`.shots/.probe-${Date.now()}-${process.pid}`)
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
  for (let i = 0; i < 60; i += 1) {
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
const logs = []
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`)
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`)
  }
})

const send = (method, params = {}) =>
  new Promise((done) => {
    const id = ++seq
    pending.set(id, done)
    ws.send(JSON.stringify({ id, method, params }))
  })

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Page.navigate', { url })
await sleep(Number(waitMs))
const result = await send('Runtime.evaluate', {
  expression: `(() => { try { return JSON.stringify(${expression}) } catch (e) { return 'THREW: ' + e.message } })()`,
  returnByValue: true,
  awaitPromise: true,
})
console.log('value:', result.result?.result?.value)
if (logs.length) console.log('logs:\n' + logs.join('\n'))

ws.close()
edge.kill()
await sleep(200)
// Edge keeps the profile locked for a moment after exit; retry instead of
// failing the probe with EPERM.
for (let i = 0; i < 12; i += 1) {
  try {
    rmSync(profileDir, { recursive: true, force: true })
    break
  } catch {
    await sleep(250)
  }
}
