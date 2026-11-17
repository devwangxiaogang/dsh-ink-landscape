/**
 * 把 ESO 的全天银河照片（Brunier 全景，CC BY 4.0）烘焙成两档皮肤底图。
 *
 * 为什么用照片而不是程序化绘制：
 *   真实的银河是「暖奶油核 + 棕黑丝缕暗尘 + 极细颗粒」，程序化画到第 4 轮仍然像
 *   塑料光束；直接使用一张真实天体照片、只做裁切/旋转/调色，观感立刻成立。
 *
 * 素材：refs/eso0932a-large.jpg（6000×3000，ESO/S. Brunier，CC BY 4.0，
 *       https://www.eso.org/public/images/eso0932a/ ）
 * 处理：裁切 + 旋转 -13° + 压暗/提对比 + 暖冷双层氛围色 + 暗角（见 art/galaxy-photo.html）
 * 产物：lib/assets/galaxy-{light,dark}.webp（3200×1800）
 *
 * 用法：node tools/bake-photo.mjs [light|dark|all]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PAGE = resolve(ROOT, 'art/galaxy-photo.html')
const OUT = resolve(ROOT, 'lib/assets')
const W = 2560
const H = 1440

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(tone) {
  const profile = resolve(ROOT, `.shots/bake-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(profile, { recursive: true })
  const port = 9333 + Math.floor(Math.random() * 400)
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${W},${H}`,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ]
  const browser = spawn(EDGE, args, { stdio: 'ignore' })

  let ws
  try {
    let target
    for (let i = 0; i < 120; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`)
        const list = await res.json()
        target = list.find((t) => t.type === 'page')
        if (target) break
      } catch {}
      await sleep(250)
    }
    if (!target) throw new Error('devtools not ready')
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((ok, bad) => {
      ws.onopen = ok
      ws.onerror = bad
    })

    let id = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    }
    const send = (method, params = {}) =>
      new Promise((ok) => {
        id += 1
        pending.set(id, ok)
        ws.send(JSON.stringify({ id, method, params }))
      })

    const url = `${pathToFileURL(PAGE).href}?tone=${tone}`
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url })
    await sleep(3500)

    const res = await send('Page.captureScreenshot', { format: 'webp', quality: 78 })
    if (!res.result?.data) throw new Error('capture failed')
    const buf = Buffer.from(res.result.data, 'base64')
    const out = resolve(OUT, `galaxy-${tone}.webp`)
    writeFileSync(out, buf)
    console.log(`baked galaxy-${tone}.webp: ${W}x${H} → ${(buf.length / 1024).toFixed(1)} KB`)
  } finally {
    try {
      ws?.close()
    } catch {}
    browser.kill()
    await sleep(400)
    for (let i = 0; i < 12; i += 1) {
      try {
        rmSync(profile, { recursive: true, force: true })
        break
      } catch {
        await sleep(250)
      }
    }
  }
}

const arg = process.argv[2] ?? 'all'
if (!existsSync(resolve(ROOT, 'refs/eso0932a-large.jpg'))) {
  console.error('missing refs/eso0932a-large.jpg')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })
mkdirSync(resolve(ROOT, '.shots'), { recursive: true })
for (const tone of arg === 'all' ? ['light', 'dark'] : [arg]) {
  await shot(tone)
}
