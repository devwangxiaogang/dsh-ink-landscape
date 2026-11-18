/**
 * 烘焙山水底图与三张星尘瓦片（银河底图见 tools/bake-photo.mjs）。
 *
 *   node tools/bake-art.mjs moods        # 山水 8 张：{clear,cloud,wet,snow}-{light,dark}
 *   node tools/bake-art.mjs tiles        # 星尘瓦片：far / near / twinkle
 *   node tools/bake-art.mjs all          # 以上全部
 *
 * 天气：同一张 art/scene.svg，靠 art/scene.css 的 8 块调色板换色、换云气不透明度，
 * 所以「晴 / 阴 / 雨 / 雪」是同一构图的不同天气，切换时不会跳形。
 *
 * 为什么烘焙：画稿里的 feTurbulence / feDisplacementMap / feGaussianBlur 每次加载都要
 * 在主线程重算，是首屏卡顿的主因；位图只需一次解码（解码线程）+ 一次合成。
 * 星尘瓦片带透明（`omitBackground`），CSS 才能把它们叠在底图上漂移。
 *
 * 输出：lib/assets/scene-{clear,cloud,wet,snow}-{light,dark}.webp、
 *       lib/assets/tile-{rain,snow}.webp、lib/assets/starfield-{far,near,twinkle}.webp
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildGalaxyBase, buildStarTile } from '../art/galaxy-gen.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const arg = process.argv[2] ?? 'galaxy'

const WIDTH = 3200
const HEIGHT = 1800
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/* ---------------------------------------------------------------- tiles ---- */

/** Deterministic PRNG so re-baking does not reshuffle the sky. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A transparent tile of stars; `near` gets bigger, brighter, sparkly ones. */
function starTile(size, count, seed, near) {
  const rand = mulberry32(seed)
  const dots = []
  for (let i = 0; i < count; i += 1) {
    const x = (rand() * size).toFixed(1)
    const y = (rand() * size).toFixed(1)
    const bright = rand()
    const r = (near ? 0.7 + bright * 1.5 : 0.35 + bright * 0.7).toFixed(2)
    const o = (near ? 0.35 + bright * 0.6 : 0.16 + bright * 0.5).toFixed(2)
    const warm = rand() > 0.86 ? '#ffe6c4' : '#dfeaff'
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${warm}" opacity="${o}"/>`)
  }
  if (near) {
    for (let i = 0; i < 5; i += 1) {
      const x = (rand() * size).toFixed(1)
      const y = (rand() * size).toFixed(1)
      dots.push(
        `<path d="M${x} ${y} l3 10 10 3 -10 3 -3 10 -3 -10 -10 -3 10 -3z" fill="#f2f7ff" opacity="0.55"/>`,
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${dots.join('')}</svg>`
}

/* ----------------------------------------------------------------- bake ---- */

function page(scheme, svg, palette, extra = '') {
  return `<!doctype html>
<html lang="zh-CN" data-ink-skin="${scheme}">
<head><meta charset="utf-8"><style>
${palette}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
#art { position: fixed; inset: 0; }
#art svg { display: block; width: 100%; height: 100%; }
${extra}
</style></head>
<body><div id="art">${svg}</div></body></html>`
}

const GRAIN = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.84" numOctaves="4" stitchTiles="stitch"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.23 0 0 0 0 0.19 0 0 0 0 0.14 0 0 0 0.7 0"/></filter>
<rect width="240" height="240" filter="url(#n)"/></svg>`

// 纸纹：浅色正片叠底压暗，深色 soft-light 提亮。雨雪底图本身更平，纸纹要收敛一点。
const GRAIN_CSS = {
  'clear-light': 'mix-blend-mode: multiply; opacity: 0.14;',
  'clear-dark': 'mix-blend-mode: soft-light; opacity: 0.26;',
  'cloud-light': 'mix-blend-mode: multiply; opacity: 0.15;',
  'cloud-dark': 'mix-blend-mode: soft-light; opacity: 0.28;',
  'wet-light': 'mix-blend-mode: multiply; opacity: 0.16;',
  'wet-dark': 'mix-blend-mode: soft-light; opacity: 0.3;',
  'snow-light': 'mix-blend-mode: multiply; opacity: 0.09;',
  'snow-dark': 'mix-blend-mode: soft-light; opacity: 0.22;',
}

const MOODS = Object.keys(GRAIN_CSS)

const read = (path) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

async function bake({
  svgPath,
  svg: inlineSvg,
  cssPath,
  scheme,
  out,
  width,
  height,
  transparent,
  extraCss = '',
  quality = 88,
}) {
  const svg = inlineSvg ?? read(svgPath)
  const palette = read(cssPath)
  const workDir = join(root, `.bake-${out}`)
  mkdirSync(workDir, { recursive: true })
  const htmlPath = join(workDir, 'index.html')
  writeFileSync(htmlPath, page(scheme, svg, palette, extraCss), 'utf8')

  const port = 9700 + Math.floor(Math.random() * 280)
  const profileDir = join(workDir, 'profile')
  mkdirSync(profileDir, { recursive: true })

  const edge = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    if (transparent) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    await send('Page.navigate', { url: `file:///${htmlPath.replace(/\\/g, '/')}` })
    await sleep(2500)

    const shot = await send('Page.captureScreenshot', {
      format: 'webp',
      quality,
      captureBeyondViewport: false,
      ...(transparent ? { omitBackground: true } : {}),
    })
    if (!shot.result?.data) throw new Error(`capture failed: ${JSON.stringify(shot.error ?? shot)}`)

    const outDir = join(root, 'lib/assets')
    mkdirSync(outDir, { recursive: true })
    const outFile = join(outDir, out)
    writeFileSync(outFile, Buffer.from(shot.result.data, 'base64'))
    const kb = (statSync(outFile).size / 1024).toFixed(1)
    console.log(`baked ${out}: ${width}x${height} → lib/assets/${out} (${kb} KB)`)
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
        rmSync(workDir, { recursive: true, force: true })
        break
      } catch {
        await sleep(250)
      }
    }
  }
}

async function ink(scheme) {
  const extra = `.grain { position: fixed; inset: 0; background-image: url("data:image/svg+xml,${encodeURIComponent(GRAIN)}"); background-size: 240px 240px; ${GRAIN_CSS[scheme]} }`
  await bake({
    svgPath: 'art/scene.svg',
    cssPath: 'art/scene.css',
    scheme,
    out: `scene-${scheme}.webp`,
    width: WIDTH,
    height: HEIGHT,
    extraCss: extra,
  })
}


async function tile(kind) {
  // 屏幕上的贴图尺寸：far 560 / near 980 / twinkle 720（见 lib/client.js 的 background-size），
  // 瓦片本身比它们略大或相当，避免放大后星点发糊。
  const size = kind === "far" ? 768 : 1024
  const svg = buildStarTile(kind, size)
  await bake({
    svg,
    cssPath: "art/galaxy.css",
    scheme: "dark",
    out: `starfield-${kind}.webp`,
    width: size,
    height: size,
    transparent: true,
  })
}

const STAR_TILES = ["far", "near", "twinkle"]

const jobs =
  arg === "all" ? [...MOODS, ...STAR_TILES] : arg === "moods" ? MOODS : arg === "tiles" ? STAR_TILES : [arg]

for (const job of jobs) {
  if (MOODS.includes(job)) await ink(job)
  else if (STAR_TILES.includes(job)) await tile(job)
  else throw new Error(`unknown target: ${job}（银河底图请用 node tools/bake-photo.mjs）`)
}
