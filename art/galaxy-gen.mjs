/**
 * 银河画稿生成器（烘焙期运行，运行期看不到任何 SVG / 滤镜）。
 *
 * 参考基准（均取自 ESO GigaGalaxy Zoom，仅作视觉参考，不作为素材分发）：
 *   - eso0934a Stéphane Guisard《340 万像素星野》：银河真正的颜色是**暖奶油+琥珀尘埃**，
 *     外圈才是冷蓝；暗尘是丝缕状、带毛边的，不是光滑的黑椭圆。
 *   - eso0932a Serge Brunier《全天 800 万像素全景》：美在克制 —— 近黑的天空 +
 *     一条细而亮的带 + 极细的颗粒感，其余全部留黑。
 *   - eso0936a 礁湖星云：暖褐色尘埃场里嵌玫瑰红发射星云、青蓝反射星云与白粉色核心。
 *
 * 因此这一版画稿的四条准则：
 *   1) 色要真：带心暖金(#f6e7c8→#e7c08c)，带缘冷蓝，绝不做成整条蓝灰；
 *   2) 质要糙：颗粒来自「上万颗细星 + 湍流云气遮罩」，不是几个大椭圆；
 *   3) 尘要丝：暗尘用带湍流位移的细长曲线笔触，压出条纹与毛边；
 *   4) 构要空：上半部大面积留黑，带子走低频斜线（-17°），只留一处亮核。
 */

/* ------------------------------------------------------------- 基础工具 ---- */

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rand) {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const r2 = (n) => Math.round(n * 100) / 100

/* --------------------------------------------------------------- 调色板 ---- */

export const GALAXY_TONES = {
  /** 暮色深空（浅色主题）：天更蓝一点，星更亮，带心仍是暖金。 */
  light: {
    sky: ['#070c17', '#0b1424', '#122036'],
    skyGlow: 'rgba(88, 132, 206, 0.16)',
    bandCore: '#fff1d4',
    bandMid: '#f0d3a4',
    bandEdge: '#9fb3d4',
    dust: '#100a05',
    nebulaRose: 'rgba(255, 118, 152, 0.16)',
    nebulaCyan: 'rgba(104, 176, 255, 0.14)',
    stars: ['#ffffff', '#e8f2ff', '#cfe0ff', '#ffe9c9', '#ffd9a8', '#ffc9de'],
    grain: 0.055,
  },
  /** 子夜银河（深色主题）：天近黑，带心更亮更暖，对比更强。 */
  dark: {
    sky: ['#010207', '#04070f', '#080f1b'],
    skyGlow: 'rgba(64, 104, 170, 0.12)',
    bandCore: '#fff6e2',
    bandMid: '#f3d5a6',
    bandEdge: '#a8bcd8',
    dust: '#080502',
    nebulaRose: 'rgba(255, 96, 136, 0.18)',
    nebulaCyan: 'rgba(96, 168, 255, 0.13)',
    stars: ['#ffffff', '#eaf4ff', '#d3e2ff', '#fff0d8', '#ffdca8', '#ffcadb'],
    grain: 0.05,
  },
}

/* ----------------------------------------------------------- 几何：银河 ---- */

const BAND_ANGLE = (-14 * Math.PI) / 180

/**
 * 银河带的中心线：一条略带弧度的斜线。
 * @returns {(t: number) => { x: number, y: number, nx: number, ny: number }}
 */
function centerline(W, H) {
  const cx = W * 0.52
  const cy = H * 0.66
  const dx = Math.cos(BAND_ANGLE)
  const dy = Math.sin(BAND_ANGLE)
  // 法线：让带有自然的弯曲（左端略下沉、右端略抬起）
  return (t) => {
    const along = (t - 0.5) * W * 1.22
    const bend = Math.sin((t - 0.12) * Math.PI * 0.9) * H * 0.055
    const x = cx + dx * along
    const y = cy + dy * along + bend
    const nx = -dy
    const ny = dx
    return { x, y, nx, ny }
  }
}

/** 0..1 的随机数（只为可读性起个名字）。 */
const p_at = (rand) => rand()

/** 带子的半宽：中间厚、两端收，另外叠一点低频起伏。 */
function halfWidth(t, H, rand) {
  const belly = Math.sin(Math.PI * Math.min(1, Math.max(0, t)) ) ** 0.7
  return H * (0.008 + 0.05 * belly) * (0.86 + rand() * 0.28)
}

/* --------------------------------------------------------------- 星点 ---- */

function sparkle(x, y, size, color, opacity, key) {
  const r = size * 3.2
  const w = size * 0.34
  return `<path key="${key}" d="M${r2(x)} ${r2(y - r)} Q${r2(x + w)} ${r2(y)} ${r2(x + r)} ${r2(y)} Q${r2(x + w)} ${r2(y)} ${r2(x)} ${r2(y + r)} Q${r2(x - w)} ${r2(y)} ${r2(x - r)} ${r2(y)} Q${r2(x - w)} ${r2(y)} ${r2(x)} ${r2(y - r)} Z" fill="${color}" opacity="${r2(opacity)}"/>`
}

const dot = (x, y, r, color, o) =>
  `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${color}" opacity="${r2(o)}"/>`

/* ------------------------------------------------------------- 主生成器 ---- */

/**
 * 生成一张银河底图。
 * @param {'light'|'dark'} scheme
 * @param {{ width?: number, height?: number, seed?: number }} [opts]
 */
export function buildGalaxyBase(scheme, opts = {}) {
  const tone = GALAXY_TONES[scheme] ?? GALAXY_TONES.dark
  const W = opts.width ?? 1600
  const H = opts.height ?? 900
  const rand = mulberry32(opts.seed ?? (scheme === 'light' ? 20261118 : 19840614))
  const line = centerline(W, H)
  const pick = () => tone.stars[Math.floor(rand() * tone.stars.length)]

  /* ---- 0) defs：所有滤镜都只在烘焙时跑一次 ---- */
  const defs = `<defs>
  <linearGradient id="gxSky" x1="0.1" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="${tone.sky[0]}"/>
    <stop offset="0.55" stop-color="${tone.sky[1]}"/>
    <stop offset="1" stop-color="${tone.sky[2]}"/>
  </linearGradient>
  <radialGradient id="gxSkyGlow" cx="0.72" cy="0.24" r="0.7">
    <stop offset="0" stop-color="${tone.skyGlow}"/>
    <stop offset="1" stop-color="rgba(0,0,0,0)"/>
  </radialGradient>

  <!-- 带体：沿带方向的暖色渐变（亮核在 t≈0.72） -->
  <linearGradient id="gxBandWarm" x1="0" y1="0" x2="1" y2="0.24">
    <stop offset="0" stop-color="${tone.bandEdge}" stop-opacity="0.34"/>
    <stop offset="0.34" stop-color="${tone.bandMid}" stop-opacity="0.6"/>
    <stop offset="0.62" stop-color="${tone.bandCore}" stop-opacity="0.9"/>
    <stop offset="0.78" stop-color="${tone.bandCore}" stop-opacity="0.96"/>
    <stop offset="0.94" stop-color="${tone.bandMid}" stop-opacity="0.5"/>
    <stop offset="1" stop-color="${tone.bandEdge}" stop-opacity="0.26"/>
  </linearGradient>
  <radialGradient id="gxCore" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${tone.bandCore}" stop-opacity="0.95"/>
    <stop offset="0.4" stop-color="${tone.bandCore}" stop-opacity="0.45"/>
    <stop offset="1" stop-color="${tone.bandCore}" stop-opacity="0"/>
  </radialGradient>

  <!-- 云气遮罩：低频湍流 -> 亮结，高频湍流 -> 颗粒 -->
  <filter id="gxKnots" x="-30%" y="-200%" width="160%" height="500%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0026 0.011" numOctaves="5" seed="11" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 5.4 -2.35" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in"/>
  </filter>
  <filter id="gxGrainy" x="-30%" y="-200%" width="160%" height="500%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55 0.75" numOctaves="3" seed="23" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.6 -1.05" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in"/>
  </filter>

  <filter id="gxEdge" x="-40%" y="-200%" width="180%" height="500%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="4" seed="41" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="52" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="4"/>
  </filter>
  <filter id="gxBandSoft" x="-40%" y="-200%" width="180%" height="500%">
    <feGaussianBlur stdDeviation="7"/>
  </filter>
  <filter id="gxBandHalo" x="-60%" y="-400%" width="220%" height="900%">
    <feGaussianBlur stdDeviation="60"/>
  </filter>
  <filter id="gxDustWarp" x="-40%" y="-200%" width="180%" height="500%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="4" seed="31" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="2.6"/>
  </filter>
  <filter id="gxStarHalo" x="-400%" y="-400%" width="900%" height="900%">
    <feGaussianBlur stdDeviation="3.4"/>
  </filter>
  <filter id="gxFinalGrain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.55  0 0 0 0.9 0"/>
  </filter>
  <radialGradient id="gxVignette" cx="0.5" cy="0.58" r="0.78">
    <stop offset="0.4" stop-color="#000000" stop-opacity="0"/>
    <stop offset="0.82" stop-color="#000205" stop-opacity="0.3"/>
    <stop offset="1" stop-color="#000205" stop-opacity="0.66"/>
  </radialGradient>
  <clipPath id="gxFrame"><rect width="${W}" height="${H}"/></clipPath>
</defs>`

  /* ---- 1) 天空 ---- */
  const sky = `<rect width="${W}" height="${H}" fill="url(#gxSky)"/>
  <rect width="${W}" height="${H}" fill="url(#gxSkyGlow)"/>`

  /* ---- 2) 带的几何：先算采样点，再拼成两条轮廓 ---- */
  const samples = 108
  const spine = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1)
    const p = line(t)
    spine.push({ t, x: p.x, y: p.y, nx: p.nx, ny: p.ny, w: halfWidth(t, H, rand) })
  }
  /** 一条边（side = ±1）的轮廓路径。 */
  const edgePath = (scale, side, jitter = 0) =>
    spine
      .map((p, i) => {
        const w = p.w * scale * (1 + (jitter ? Math.sin(i * 1.7) * jitter : 0))
        return `${i === 0 ? 'M' : 'L'}${r2(p.x + p.nx * w * side)} ${r2(p.y + p.ny * w * side)}`
      })
      .join(' ')
  const ribbon = (scale) =>
    `${edgePath(scale, 1)} L${r2(spine[spine.length - 1].x - spine[spine.length - 1].nx * 0)} ${r2(spine[spine.length - 1].y)} ${edgePath(scale, -1)
      .split(' ')
      .reverse()
      .join(' ')} Z`

  /* ---- 3) 带 = 三千个软斑叠出来的「云气」 ----
     整条带用一次 blur 的软斑群组绘制：斑块尺寸/透明度都抖动，
     于是自然出现明暗结块与毛边；比单条 ribbon 更接近真实银河的「絮状」。 */
  const clouds = []
  const warmTints = ['#fff0d2', '#ffe2b8', '#f3d3a6', '#e9c9a0', '#cfd8ea', '#ffffff']
  for (let i = 0; i < 6800; i += 1) {
    // 沿带分布：中间密两端疏
    const t = Math.min(1, Math.max(0, 0.5 + gauss(rand) * 0.36))
    const p = line(t)
    const k = gauss(rand) * 0.85
    const off = k * p.w * 1.7
    const x = p.x + p.nx * off
    const y = p.y + p.ny * off
    const centrality = Math.exp(-k * k)
    // 靠中心的斑更大更亮
    const rx = H * (0.004 + rand() * 0.018) * (0.55 + centrality)
    const ry = rx * (0.4 + rand() * 0.7)
    const tint = warmTints[Math.floor(rand() * warmTints.length)]
    const o = (0.03 + rand() * 0.07) * (0.28 + centrality)
    clouds.push(
      `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${tint}" opacity="${r2(o)}" transform="rotate(${r2(gauss(rand) * 25)} ${r2(x)} ${r2(y)})"/>`,
    )
  }
  // 带心再加一层更亮的絮状云
  const core = line(0.72)
  for (let i = 0; i < 1400; i += 1) {
    const dx = gauss(rand) * H * 0.075
    const dy = gauss(rand) * H * 0.042
    const rx = H * (0.005 + rand() * 0.016)
    clouds.push(
      `<ellipse cx="${r2(core.x + dx)}" cy="${r2(core.y + dy)}" rx="${r2(rx)}" ry="${r2(rx * (0.4 + rand() * 0.5))}" fill="${warmTints[Math.floor(rand() * warmTints.length)]}" opacity="${r2(0.04 + rand() * 0.09)}"/>`,
    )
  }

  const band = []
  // 极淡的底光，只保证带子「连续」
  band.push(`<path d="${ribbon(2.6)}" fill="url(#gxBandWarm)" opacity="0.14" filter="url(#gxBandHalo)"/>`)
  band.push(`<g filter="url(#gxBandSoft)">${clouds.join('')}</g>`)

  // 星云点缀：玫瑰（核左侧）+ 青蓝（左端）
  const rose = line(0.6)
  const cyan = line(0.16)
  band.push(
    `<ellipse cx="${r2(rose.x)}" cy="${r2(rose.y - H * 0.03)}" rx="${r2(H * 0.075)}" ry="${r2(H * 0.05)}" fill="${tone.nebulaRose}" filter="url(#gxBandHalo)"/>`,
    `<ellipse cx="${r2(cyan.x)}" cy="${r2(cyan.y + H * 0.03)}" rx="${r2(H * 0.06)}" ry="${r2(H * 0.04)}" fill="${tone.nebulaCyan}" filter="url(#gxBandHalo)"/>`,
  )

  /* ---- 5) 颗粒层：一万八千颗极细的星铺在带上，只负责「不光滑」 ---- */
  const milk = []
  const warm = ['#fff3dc', '#ffe6c2', '#f7d9ad', '#ffffff', '#e9f0ff']
  for (let i = 0; i < 18000; i += 1) {
    const t = Math.min(1, Math.max(0, 0.5 + gauss(rand) * 0.36))
    const p = line(t)
    const k = gauss(rand) * 0.7
    const off = k * p.w * 1.9
    const x = p.x + p.nx * off
    const y = p.y + p.ny * off
    const centrality = Math.exp(-k * k)
    const m = rand()
    milk.push(dot(x, y, 0.1 + m * 0.3, warm[Math.floor(rand() * warm.length)], (0.07 + m * 0.18) * (0.45 + centrality)))
  }

  /* ---- 6) 暗尘：软斑组成的深色纹路，压在云气之上、亮星之下 ---- */
  const filaments = []
  for (let i = 0; i < 150; i += 1) {
    const t = 0.04 + rand() * 0.86
    const p = line(t)
    const k = gauss(rand) * 0.5 + (rand() < 0.5 ? -0.55 : 0.55)
    const off = k * p.w * 1.5
    const x = p.x + p.nx * off
    const y = p.y + p.ny * off
    const rx = H * (0.004 + rand() * 0.022)
    filaments.push(
      `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(rx)}" ry="${r2(rx * (0.3 + rand() * 0.5))}" fill="${tone.dust}" opacity="${r2(0.08 + rand() * 0.2)}" transform="rotate(${r2(-14 + gauss(rand) * 18)} ${r2(x)} ${r2(y)})"/>`,
    )
  }
  const dust = `<g filter="url(#gxBandSoft)">${filaments.join('')}</g>`

  /* ---- 7) 亮星：带上十几颗带星芒的，带外三十颗散落 ---- */
  const bandBright = []
  for (let i = 0; i < 16; i += 1) {
    const t = rand()
    const p = line(t)
    const off = gauss(rand) * p.w * 0.7
    const x = p.x + p.nx * off
    const y = p.y + p.ny * off
    const m = rand()
    const size = 0.8 + m * 1.7
    const color = warm[Math.floor(rand() * warm.length)]
    bandBright.push(
      `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(size * 4.5)}" fill="${color}" opacity="${r2(0.05 + m * 0.06)}" filter="url(#gxStarHalo)"/>`,
    )
    bandBright.push(sparkle(x, y, size, color, 0.4 + m * 0.35, `c${i}`))
  }

  /* ---- 7b) 场星：带外稀疏铺满 ---- */
  const starsField = []
  for (let i = 0; i < 2000; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const near = Math.abs(y - (H * 0.66 + (x - W * 0.52) * Math.tan(BAND_ANGLE))) / H
    if (near < 0.2) continue
    const m = rand()
    starsField.push(dot(x, y, 0.16 + m * m * 0.85, tone.stars[Math.floor(rand() * tone.stars.length)], 0.12 + m * 0.5))
  }

  const bright = []
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const near = Math.abs(y - (H * 0.66 + (x - W * 0.52) * Math.tan(BAND_ANGLE))) / H
    if (near < 0.22) continue
    const m = rand()
    const size = 0.9 + m * 2
    const color = tone.stars[Math.floor(rand() * tone.stars.length)]
    bright.push(
      `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(size * 5)}" fill="${color}" opacity="${r2(0.04 + m * 0.07)}" filter="url(#gxStarHalo)"/>`,
    )
    bright.push(sparkle(x, y, size, color, 0.5 + m * 0.4, `b${i}`))
  }

  /* ---- 8) 收口：暗角 + 全幅极轻颗粒（把渐变打散，去掉「塑料感」） ---- */
  const finish = `<rect width="${W}" height="${H}" fill="url(#gxVignette)"/>
  <rect width="${W}" height="${H}" filter="url(#gxFinalGrain)" opacity="${tone.grain}" style="mix-blend-mode:overlay"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g clip-path="url(#gxFrame)">
${defs}
${sky}
<g>${band.join('')}</g>
<g>${milk.join('')}</g>
${dust}
<g>${bandBright.join('')}</g>
<g>${starsField.join('')}</g>
<g>${bright.join('')}</g>
${finish}
</g>
</svg>`
}

/* --------------------------------------------------------- 视差星尘瓦片 ---- */

/**
 * 透明瓦片：`far` 细密星尘、`near` 少量大星（带光晕与星芒）、`twinkle` 十几颗闪烁星。
 * @param {'far'|'near'|'twinkle'} kind
 */
export function buildStarTile(kind, size = 1024) {
  // 瓦片是按 CSS background-size 贴到屏幕上的，所以要按「屏幕上一颗星该多大」来定半径：
  // 屏幕尺寸 ≈ 瓦片尺寸时，r≈0.5-1.2px 才接近真实星点；再靠透明度做出层次。
  const conf = {
    far: { seed: 0x5eed11, count: 900, rMin: 0.26, rMax: 0.95, aMin: 0.12, aMax: 0.5, flare: 0, flareLen: 0 },
    near: { seed: 0x5eed22, count: 150, rMin: 0.45, rMax: 1.25, aMin: 0.3, aMax: 0.78, flare: 0.94, flareLen: 0.8 },
    twinkle: { seed: 0x5eed33, count: 260, rMin: 0.35, rMax: 1.05, aMin: 0.25, aMax: 0.7, flare: 0.9, flareLen: 0.7 },
  }[kind]
  const rand = mulberry32(conf.seed)
  const palette = ['#ffffff', '#e8f2ff', '#cfe0ff', '#ffe9c9', '#ffd9a8', '#ffc9de']
  const pick = () => palette[Math.floor(rand() * palette.length)]
  const nodes = []

  for (let i = 0; i < conf.count; i += 1) {
    const x = rand() * size
    const y = rand() * size
    const m = rand()
    const color = pick()
    const r = conf.rMin + m * (conf.rMax - conf.rMin)
    const alpha = conf.aMin + rand() * (conf.aMax - conf.aMin)
    if (conf.flare && m > conf.flare) {
      nodes.push(sparkle(x, y, conf.flareLen + rand() * 0.5, color, alpha, `${kind}${i}`))
    } else {
      nodes.push(dot(x, y, r, color, alpha))
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${nodes.join('')}</svg>`
}
