/**
 * Drive the real DSH web shell through CDP and report what the skin did:
 * console errors, whether the plugin's DOM/CSS landed, and which theme is active.
 *
 *   node tools/probe.mjs <url> [waitMs]
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const [, , url, waitMsArg = '10000'] = process.argv
if (!url) {
  console.error('usage: node tools/probe.mjs <url> [waitMs]')
  process.exit(2)
}
const waitMs = Number(waitMsArg)
const port = 9550 + Math.floor(Math.random() * 200)
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profileDir = resolve('.shots/.cdp-probe')

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1680,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let page
  for (let i = 0; i < 80; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      page = targets.find((t) => t.type === 'page')
      if (page) break
    } catch {}
    await sleep(250)
  }
  if (!page) throw new Error('no page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let seq = 0
  const pending = new Map()
  const events = []
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      seq += 1
      pending.set(seq, { res, rej })
      ws.send(JSON.stringify({ id: seq, method, params }))
    })
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) rej(new Error(msg.error.message))
      else res(msg.result)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ')
      events.push(`[console.${msg.params.type}] ${text}`)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      events.push(`[exception] ${d.text} ${d.exception?.description ?? ''}`.slice(0, 900))
    }
    if (msg.method === 'Log.entryAdded') {
      events.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text}`.slice(0, 900))
    }
  })

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Page.navigate', { url })
  await sleep(waitMs)

  const probe = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const html = document.documentElement
      const scene = document.getElementById('dsh-ink-scene')
      const styles = [...document.querySelectorAll('style[data-plugin="dsh-ink-landscape"]')].map((s) => s.dataset.pluginCss)
      const brand = document.querySelector('[data-slot="sidebar.brand.mark"]')
      return {
        inkSkin: html.getAttribute('data-ink-skin'),
        scenePresent: Boolean(scene),
        sceneSvgLayers: scene ? scene.querySelectorAll('svg g[id]').length : 0,
        inkStyles: styles,
        brandSlotHtml: brand ? brand.innerHTML.slice(0, 200) : null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bgBase: getComputedStyle(html).getPropertyValue('--dsw-alias-bg-base').trim(),
        fontFamily: getComputedStyle(document.body).fontFamily.slice(0, 120),
        storedPref: localStorage.getItem('dsh-ink-landscape:preference'),
        bootRows: (window.__DSH_BOOT__?.entries ?? []).map((e) => e.id).filter((id) => id.includes('ink')),
      }
    })()`,
  })
  console.log('--- probe ---')
  console.log(JSON.stringify(probe.result.value, null, 2))
  console.log('--- events ---')
  for (const line of events.slice(-60)) console.log(line)
  ws.close()
}

main()
  .then(() => {
    browser.kill()
    process.exit(0)
  })
  .catch((e) => {
    console.error('probe failed:', e.message)
    browser.kill()
    process.exit(1)
  })
