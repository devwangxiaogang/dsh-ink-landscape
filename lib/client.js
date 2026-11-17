/* dsh-ink-landscape — 沉浸式中国山水皮肤 / immersive Chinese ink-wash landscape skin
 *
 * Client half. Hand-written as a single lazy-CJS bundle so the package needs no
 * build step: executing this script only registers the factory; every side
 * effect (theme registration, CSS injection, scene mounting) runs at
 * materialization inside apply().
 *
 * The landscape is one inline <svg> whose colors are CSS variables, so the two
 * schemes recolor instantly with no image regeneration. The package ships no
 * binary assets and requests no external fonts.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ink-landscape',
  factory: (require) => {
    var module = { exports: {} }

    const React = require('react')

    const PLUGIN_ID = 'dsh-ink-landscape'
    const STORE_KEY = 'dsh-ink-landscape'
    const SCENE_ID = 'dsh-ink-scene'

    // 皮肤家族（data-ink-skin）与色调（data-ink-tone）是两个维度：
    // 家族决定用哪套 token / 哪张底图 / 哪些标注，色调跟随应用的浅色/深色。
    const SKIN_DEFAULT = 'default'   // 原皮肤（完全不介入）
    const SKIN_INK = 'ink'           // 溪山无尽 · 水墨山水
    const SKIN_GALAXY = 'galaxy'     // 银河星图
    const TONE_LIGHT = 'light'
    const TONE_DARK = 'dark'

    /* ------------------------------------------------------------------ *
     * 0. Palette
     * ------------------------------------------------------------------ */

    const PALETTE = {
      dawn: {
        scheme: 'light',
        paper: '#faf7ef',
        paperHi: '#fffdf7',
        paperLo: '#f1ebe0',
        ink: '#26221d',
        inkSoft: '#4c453c',
        inkFaint: '#7c7263',
        inkGhost: '#a89d8b',
        vermilion: '#a8362a',
        vermilionHi: '#c2482f',
        celadon: '#5d7f6e',
        indigo: '#3a5f7d',
        ochre: '#b07a2c',
        moss: '#6d7c52',
      },
      night: {
        scheme: 'dark',
        paper: '#12171b',
        paperHi: '#1b2228',
        paperLo: '#0c1013',
        ink: '#efe8d9',
        inkSoft: '#c7bfae',
        inkFaint: '#9d9585',
        inkGhost: '#6f6a5f',
        vermilion: '#c65a3d',
        vermilionHi: '#d9704d',
        celadon: '#7fa791',
        indigo: '#7d9dc0',
        ochre: '#d0a45e',
        moss: '#98a67c',
      },
      // 银河：浅色 scheme 用「暮色深空」（比子夜亮一档，和 shell 的浅色控件不打架）
      galaxyDeep: {
        scheme: 'light',
        paper: '#101a2b',
        paperHi: '#16233a',
        paperLo: '#0b1220',
        ink: '#e8f0fb',
        inkSoft: '#b9c9e0',
        inkFaint: '#8598b4',
        inkGhost: '#5b6b85',
        vermilion: '#6fc3ff',      // brand 主色：星芒青
        vermilionHi: '#9ad9ff',
        celadon: '#7fe0c8',
        indigo: '#8fb6ff',
        ochre: '#ffcf8a',
        moss: '#9be0b4',
        veil: { base: 0.1, baseDark: 0.14, layer1: 0.8, layer1Dark: 0.78, layer2: 0.86, layer2Dark: 0.84, sidebar: 0.62, sidebarDark: 0.62, input: 0.86, inputDark: 0.84, menu: 0.9 },
      },
      // 银河：深色 scheme 用「子夜银河」
      galaxyVoid: {
        scheme: 'dark',
        paper: '#070b14',
        paperHi: '#0d1420',
        paperLo: '#04070d',
        ink: '#eef4ff',
        inkSoft: '#c2d2e8',
        inkFaint: '#8296b2',
        inkGhost: '#54637a',
        vermilion: '#7fd4e8',
        vermilionHi: '#a6e6f5',
        celadon: '#86e6cf',
        indigo: '#9dbeff',
        ochre: '#ffd79b',
        moss: '#a6e8c0',
        veil: { base: 0.1, baseDark: 0.14, layer1: 0.8, layer1Dark: 0.78, layer2: 0.86, layer2Dark: 0.84, sidebar: 0.62, sidebarDark: 0.62, input: 0.86, inputDark: 0.84, menu: 0.9 },
      },
    }

    /** rgba() from a #rrggbb hex plus alpha. */
    function rgba(hex, alpha) {
      const n = parseInt(hex.slice(1), 16)
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
    }

    /** color-mix() of a hex with paper — used for soft paper-tinted fills. */
    function mix(hex, other, weight) {
      return `color-mix(in srgb, ${hex} ${weight}%, ${other})`
    }

    /**
     * Build the alias/specific token map for one palette.
     * @param p - One palette entry from {@link PALETTE}.
     * @returns token name to CSS value, covering every color-bearing alias token.
     */
    function tokens(p) {
      const light = p.scheme === 'light'
      const inkOn = light ? '#fdf8ec' : '#0d1114'
      // 每套 palette 可以自带 surface 透明度（星空比宣纸更"花"，纸要更厚）。
      const v = p.veil ?? {}
      const vBase = light ? (v.base ?? 0.12) : (v.baseDark ?? 0.2)
      const vLayer1 = light ? (v.layer1 ?? 0.72) : (v.layer1Dark ?? 0.7)
      const vLayer2 = light ? (v.layer2 ?? 0.66) : (v.layer2Dark ?? 0.64)
      const vSidebar = light ? (v.sidebar ?? 0.3) : (v.sidebarDark ?? 0.36)
      return {
        // ---------- surfaces (translucent: the landscape reads through) ----------
        // The shell paints bg-base on four nested full-viewport layers (body,
        // frame, root, tab host), so the composite opacity is 1-(1-a)^4:
        // ~0.32 lands near 0.80 — paper over the surface, painted ranges still
        // legible underneath.
        '--dsw-alias-bg-base': rgba(p.paper, vBase),
        '--dsw-alias-bg-layer-1': rgba(p.paperHi, vLayer1),
        '--dsw-alias-bg-layer-2': rgba(p.paper, vLayer2),
        '--dsw-alias-bg-layer-3': rgba(p.paperLo, light ? 0.6 : 0.58),
        '--dsw-alias-bg-overlay': rgba(p.paperHi, 0.97),
        '--dsw-alias-bg-module-platform': rgba(p.paperLo, light ? 0.56 : 0.54),
        '--dsw-alias-bg-multi-select': rgba(p.paperLo, light ? 0.62 : 0.6),
        '--dsw-alias-bg-skeleton': rgba(p.ink, light ? 0.06 : 0.1),
        '--dsw-alias-bg-document-preview': rgba(p.paperLo, 0.9),
        '--dsw-alias-bg-document-selection': rgba(p.vermilion, 0.22),
        '--dsw-alias-bg-mask-1': rgba('#0e1216', light ? 0.4 : 0.56),
        '--dsw-alias-bg-mask-2': rgba('#0e1216', light ? 0.22 : 0.3),
        '--dsw-alias-bg-mask-3': rgba('#0e1216', 0.48),
        '--dsw-alias-bg-mask-photo': rgba('#0b0e11', 0.88),
        '--dsw-alias-bg-mask-drop': rgba(p.paper, 0.78),

        // ---------- hairlines (ink) ----------
        '--dsw-alias-border-l1': rgba(p.ink, light ? 0.1 : 0.14),
        '--dsw-alias-border-l2': rgba(p.ink, light ? 0.16 : 0.2),
        '--dsw-alias-border-l2-darkmode-thin': rgba(p.ink, light ? 0.12 : 0.16),
        '--dsw-alias-border-l3': rgba(p.ink, light ? 0.24 : 0.28),
        '--dsw-alias-border-l4': rgba(p.ink, light ? 0.32 : 0.36),
        '--dsw-alias-border-inverted': rgba(p.paperHi, 0.2),
        '--dsw-alias-border-inverted2': rgba(p.paperHi, 0.34),
        '--dsw-alias-border-selected': rgba(p.vermilion, 0.6),

        // ---------- type ----------
        '--dsw-alias-label-primary': p.ink,
        '--dsw-alias-label-secondary': p.inkSoft,
        '--dsw-alias-label-tertiary': p.inkFaint,
        '--dsw-alias-label-caption': p.inkFaint,
        '--dsw-alias-label-dimmed': rgba(p.ink, light ? 0.34 : 0.4),
        '--dsw-alias-label-primary-dimmed': rgba(p.ink, 0.72),
        '--dsw-alias-label-primary-inverted': inkOn,
        '--dsw-alias-label-primary-foreground': inkOn,
        '--dsw-alias-label-primary-bluish': p.ink,
        '--dsw-alias-label-on-color': inkOn,
        '--dsw-alias-label-shimmer': rgba(p.ink, 0.28),
        '--dsw-alias-label-deep-diving': mix(p.vermilion, p.ink, 62),
        '--dsw-alias-label-deep-diving-shimmer': mix(p.vermilion, p.paper, 28),
        '--dsw-alias-label-document-preview': p.inkSoft,
        '--dsw-alias-menu-icon': p.inkSoft,

        // ---------- brand (朱砂) ----------
        '--dsw-alias-brand-primary': p.vermilion,
        '--dsw-alias-brand-primary-invert': inkOn,
        '--dsw-alias-brand-primary-new-colorprimary-new-color': p.vermilionHi,
        '--dsw-alias-brand-text': p.vermilion,
        '--dsw-alias-link': p.indigo,

        // ---------- buttons ----------
        '--dsw-alias-button-primary-fill': p.vermilion,
        '--dsw-alias-button-primary-hover': p.vermilionHi,
        '--dsw-alias-button-primary-dimmed': rgba(p.vermilion, light ? 0.16 : 0.22),
        '--dsw-alias-button-contrast-fill': p.ink,
        '--dsw-alias-button-elevated-fill': rgba(p.paperHi, 0.96),
        '--dsw-alias-button-floating-fill': rgba(p.paperHi, 0.92),
        '--dsw-alias-button-floating-hover': rgba(p.paperLo, 0.96),
        '--dsw-alias-button-ghost-active-fill': rgba(p.ink, light ? 0.08 : 0.12),
        '--dsw-alias-button-ghost-active-hover': rgba(p.ink, light ? 0.12 : 0.16),
        '--dsw-alias-button-ghost-active-border': rgba(p.ink, 0.28),
        '--dsw-alias-button-info-fill': p.indigo,
        '--dsw-alias-button-info-hover': mix(p.indigo, p.ink, 82),
        '--dsw-alias-button-tool-bar-fill': rgba(p.ink, light ? 0.34 : 0.42),
        '--dsw-alias-button-tool-bar-fill-invisible': rgba(p.ink, 0.08),
        '--dsw-alias-button-tool-bar-hover': rgba(p.ink, 0.5),

        // ---------- interaction ----------
        '--dsw-alias-interactive-bg-hover': rgba(p.ink, light ? 0.05 : 0.08),
        '--dsw-alias-interactive-bg-active': rgba(p.ink, light ? 0.09 : 0.13),
        '--dsw-alias-interactive-bg-hover-accent': rgba(p.vermilion, 0.1),
        '--dsw-alias-interactive-bg-hover-danger': rgba(p.vermilion, 0.12),
        '--dsw-alias-interactive-bg-hover-solid': rgba(p.paperLo, 0.9),

        // ---------- state ----------
        '--dsw-alias-state-success-primary': p.celadon,
        '--dsw-alias-state-success-secondary': mix(p.celadon, p.paper, 62),
        '--dsw-alias-state-success-tertiary': rgba(p.celadon, 0.18),
        '--dsw-alias-state-warn-primary': p.ochre,
        '--dsw-alias-state-warn-secondary': mix(p.ochre, p.paper, 58),
        '--dsw-alias-state-warn-tertiary': rgba(p.ochre, 0.16),
        '--dsw-alias-state-warn-label': light ? '#8a5a12' : p.ochre,
        '--dsw-alias-state-error-primary': p.vermilion,
        '--dsw-alias-state-error-secondary': p.vermilionHi,
        '--dsw-alias-state-idle-primary': rgba(p.ink, light ? 0.28 : 0.34),
        '--dsw-alias-state-business-primary': p.celadon,
        '--dsw-alias-state-business-tertiary': rgba(p.celadon, 0.2),
        '--dsw-alias-state-done-primary': p.moss,

        // ---------- cards / menu / overlay chrome ----------
        '--dsw-alias-card-fill': rgba(p.paperHi, light ? 0.5 : 0.48),
        '--dsw-alias-card-fill-hover': rgba(p.paperHi, light ? 0.82 : 0.72),
        '--dsw-alias-card-tile-fill': rgba(p.paperHi, 0.4),
        '--dsw-alias-menu-group-header-fill': rgba(p.paperLo, 0.9),
        // 弹出层的“玻璃”材质：外壳读的是 --dsw-menu-surface-fill（不是
        // --dsw-specific-menu），所以两者都要给，否则弹框会露出出厂的白。
        // 菜单是“盖在画面上的玻璃”：太透会看不清字，太实又断了沉浸感，
        // 所以每套 palette 用 veil.menu 自己定（银河深色底要更实一点）。
        '--dsw-menu-surface-fill': rgba(p.paperHi, v.menu ?? (light ? 0.84 : 0.9)),
        '--dsw-alias-menu-group-header-fill': rgba(p.paperLo, light ? 0.88 : 0.92),
        '--dsw-menu-backdrop-filter': 'blur(22px) saturate(1.4)',
        '--dsw-specific-menu': rgba(p.paperHi, light ? 0.94 : 0.95),
        '--dsw-specific-selector': rgba(p.paperLo, 0.8),
        '--dsw-specific-tip': rgba(p.paperLo, light ? 0.96 : 0.94),
        // 外壳（侧栏 / 天头）的竖向 wash：外壳自己只有一层纯色，加一层渐变
        // 才有"纸/雾"的纵深；变量放在这里，随 palette 一起换成墨色或星蓝。
        '--ink-shell-wash-top': rgba(p.paperHi, 0.14),
        '--ink-shell-wash-bottom': rgba(p.paperLo, light ? 0.5 : 0.62),
        '--ink-shell-rule': rgba(p.indigo, light ? 0.2 : 0.24),
        '--ink-head-glow': rgba(p.paperHi, light ? 0.24 : 0.22),
        // 天头的一道品牌色细线：朱砂（山水）/ 星蓝（银河），只取一点点。
        '--ink-head-accent': rgba(p.vermilion, light ? 0.2 : 0.26),
        '--dsw-specific-sidebar-fill': rgba(p.paper, vSidebar),
        '--dsw-specific-sidebar-tint': rgba(p.paperLo, 0.18),
        '--dsw-specific-sidebar-wash-top': rgba(p.celadon, 0.08),
        '--dsw-specific-sidebar-wash-top-clear': rgba(p.celadon, 0),
        '--dsw-specific-sidebar-wash-bottom': rgba(p.vermilion, 0.07),
        '--dsw-specific-sidebar-wash-bottom-clear': rgba(p.vermilion, 0),
        '--dsw-specific-sidebar-glass-fill': rgba(p.paperHi, light ? 0.6 : 0.54),
        '--dsw-specific-sidebar-glass-hover': rgba(p.paperHi, light ? 0.78 : 0.66),
        '--dsw-specific-sidebar-glass-collapsed-fill': 'transparent',
        '--dsw-specific-sidebar-glass-collapsed-hover': rgba(p.ink, light ? 0.06 : 0.1),
        '--dsw-specific-sidebar-nav-item-active': rgba(p.ink, light ? 0.07 : 0.12),
        '--dsw-specific-sidebar-nav-item-active-accent': rgba(p.vermilion, 0.72),
        '--dsw-specific-sidebar-right-flash': rgba(p.vermilion, 0.55),
        '--dsw-specific-bubble': rgba(p.paperHi, light ? 0.52 : 0.46),
        '--dsw-specific-bubble-highlight': rgba(p.vermilion, 0.14),
        // 输入框是常驻正文面：星空比宣纸更“花”，所以银河的两档 palette 自带
        // input 厚度（veil.input/inputDark），默认沿用山水的 0.76/0.66。
        '--dsw-specific-input-major': rgba(p.paperHi, light ? (v.input ?? 0.76) : (v.inputDark ?? 0.66)),
        '--dsw-specific-login-input': rgba(p.paperHi, 0.9),
        '--dsw-specific-file-upload-track': rgba(p.ink, 0.1),
        '--dsw-specific-guide-hero': rgba(p.paperLo, 0.6),

        // ---------- markdown / code ----------
        '--dsw-alias-markdown-code-block': rgba(p.ink, light ? 0.05 : 0.06),
        '--dsw-alias-markdown-code-block-banner': rgba(p.ink, light ? 0.075 : 0.085),
        '--dsw-alias-markdown-code-segment-selected': rgba(p.paperHi, 0.96),
        '--dsw-alias-markdown-code-segment-unselected': rgba(p.paperLo, 0.72),
        '--dsw-alias-markdown-inline-code': rgba(p.ink, light ? 0.07 : 0.1),
        '--dsw-alias-markdown-tag': rgba(p.paperLo, 0.7),
        '--dsw-alias-markdown-citation': rgba(p.paperLo, 0.62),
        '--dsw-alias-markdown-placeholder': p.inkGhost,
        '--dsw-alias-code-diff-added': rgba(p.celadon, 0.16),
        '--dsw-alias-code-diff-deleted': rgba(p.vermilion, 0.16),
        '--dsw-alias-file-diff-added-bg': rgba(p.celadon, light ? 0.14 : 0.2),
        '--dsw-alias-file-diff-added-gutter': rgba(p.celadon, light ? 0.2 : 0.26),
        '--dsw-alias-file-diff-added-marker': p.celadon,
        '--dsw-alias-file-diff-deleted-bg': rgba(p.vermilion, light ? 0.12 : 0.18),
        '--dsw-alias-file-diff-deleted-gutter': rgba(p.vermilion, light ? 0.18 : 0.24),
        '--dsw-alias-file-diff-deleted-marker': p.vermilion,

        // ---------- scrollbar ----------
        '--dsw-alias-scrollbar-bg-l1': rgba(p.ink, light ? 0.16 : 0.24),
        '--dsw-alias-scrollbar-bg-l2': rgba(p.ink, light ? 0.14 : 0.2),
        '--dsw-alias-scrollbar-hover-l1': rgba(p.ink, light ? 0.3 : 0.36),
        '--dsw-alias-scrollbar-hover-l2': rgba(p.ink, light ? 0.26 : 0.32),

        // ---------- tooltip / toast / hovercard ----------
        '--dsw-alias-tooltip-bg': light ? 'rgba(38, 34, 29, 0.94)' : 'rgba(238, 231, 218, 0.94)',
        '--dsw-alias-tooltip-label': light ? '#f7f1e4' : '#171b1f',
        '--dsw-alias-tooltip-key-bg': light ? 'rgba(247, 241, 228, 0.16)' : 'rgba(23, 27, 31, 0.12)',
        '--dsw-alias-toast-bg': light ? 'rgba(38, 34, 29, 0.95)' : 'rgba(240, 233, 220, 0.95)',
        '--dsw-alias-toast-label': light ? '#f7f1e4' : '#171b1f',
        '--dsw-alias-toast-action': light ? mix(p.vermilion, p.paper, 34) : p.vermilion,
        '--dsw-alias-hovercard-bg': light ? 'rgba(38, 34, 29, 0.95)' : 'rgba(240, 233, 220, 0.95)',
        '--dsw-alias-hovercard-label-primary': light ? '#f7f1e4' : '#171b1f',
        '--dsw-alias-hovercard-label-secondary': light ? 'rgba(247, 241, 228, 0.78)' : 'rgba(23, 27, 31, 0.72)',
        '--dsw-alias-hovercard-label-tertiary': light ? 'rgba(247, 241, 228, 0.6)' : 'rgba(23, 27, 31, 0.55)',
        '--dsw-alias-hovercard-state-done': p.moss,
        '--dsw-alias-hovercard-state-error': light ? '#e0866c' : '#a8362a',

        // ---------- charts / trajectory / turn ----------
        '--dsw-alias-chart-messages': p.indigo,
        '--dsw-alias-chart-system': p.inkFaint,
        '--dsw-alias-chart-tools': p.moss,
        '--dsw-alias-trajectory-accent': p.vermilion,
        '--dsw-alias-turn-trigger-bg': rgba(p.ink, light ? 0.05 : 0.08),
        '--dsw-alias-turn-trigger-bg-hover': rgba(p.ink, light ? 0.09 : 0.13),

        // ---------- settings / onboarding / illustration ----------
        '--dsw-alias-settings-card-fill': rgba(p.paperHi, light ? 0.5 : 0.48),
        '--dsw-alias-settings-card-stroke': rgba(p.ink, light ? 0.14 : 0.18),
        '--dsw-alias-onboarding-accent': p.vermilion,
        '--dsw-alias-onboarding-card-fill': rgba(p.paperHi, light ? 0.76 : 0.62),
        '--dsw-alias-onboarding-secondary-fill': rgba(p.paperHi, 0.92),
        '--dsw-alias-onboarding-checkbox-border': rgba(p.ink, 0.28),
        '--dsw-alias-illustration-background': rgba(p.paperLo, 0.58),
        '--dsw-alias-illustration-backing': rgba(p.ink, 0.16),
        '--dsw-alias-illustration-detail': rgba(p.ink, 0.3),
        '--dsw-alias-illustration-inset': rgba(p.paperHi, 0.7),
        '--dsw-alias-illustration-shadow': rgba(p.ink, 0.12),
        '--dsw-alias-illustration-surface': rgba(p.paperHi, 0.85),
        '--dsw-alias-switch-thumb': light ? '#fdf8ec' : '#0e1316',

        // ---------- json tree ----------
        '--dsw-alias-json-tree-hover': rgba(p.ink, 0.05),
        '--dsw-alias-json-tree-icon': p.inkFaint,
        '--dsw-alias-json-tree-keyword': light ? '#1f4a8c' : '#8fb6e8',
        '--dsw-alias-json-tree-number': light ? '#8c3b1f' : '#e5a878',
        '--dsw-alias-json-tree-property': light ? '#6b2d6b' : '#d3a1d3',
        '--dsw-alias-json-tree-punctuation': p.inkSoft,
        '--dsw-alias-json-tree-string': light ? '#8c2f1c' : '#e8967c',
      }
    }

    /* ART:BEGIN */
    /**
     * The landscape is one pre-rendered raster per scheme, baked at authoring
     * time from `art/scene.svg` by `tools/bake-art.mjs`.
     *
     * Why not ship the SVG: it carries 24 filter applications — three
     * `feTurbulence` + `feDisplacementMap` chains over full-width ridges and
     * eleven `feGaussianBlur stdDeviation="17"` mist shapes whose filter region
     * is 160% × 440% of the canvas. Re-running those filters costs hundreds of
     * milliseconds on the main thread and made the shell stutter for the first
     * second or two after load. A raster costs one off-thread decode instead.
     */
    const SCENE_ART_BASE = '/plugins/dsh-ink-landscape/assets'

    /** 每套皮肤两种色调各一张烘焙图，另外两片透明星尘瓦片；见 `tools/bake-art.mjs`。 */
    const SCENE_ASSETS = {
      dawn: `${SCENE_ART_BASE}/scene-dawn.webp`,
      night: `${SCENE_ART_BASE}/scene-night.webp`,
      galaxyLight: `${SCENE_ART_BASE}/galaxy-light.webp`,
      galaxyDark: `${SCENE_ART_BASE}/galaxy-dark.webp`,
      starsFar: `${SCENE_ART_BASE}/starfield-far.webp`,
      starsNear: `${SCENE_ART_BASE}/starfield-near.webp`,
      starsTwinkle: `${SCENE_ART_BASE}/starfield-twinkle.webp`,
    }
    /* ART:END */

    /* ------------------------------------------------------------------ *
     * 2. Stylesheets
     * ------------------------------------------------------------------ */


    /**
     * 两套皮肤共用的外壳规则：内容面必须是实纸（沉浸感只留给画布），
     * 滚动条统一收细。选择器只用 `html[data-ink-skin]` —— 原皮肤时该属性不存在，
     * 这条规则自然失效，DSH 恢复原样。
     */
    const BASE_CSS = `
/* 对话框 / 设置面板：shell 用半透明的 bg-layer-2 画它，画布会从底下透上来。 */
html[data-ink-skin] [role="dialog"] {
  background-color: var(--dsw-alias-bg-overlay);
  box-shadow: var(--dsw-shadow-lv2);
  backdrop-filter: none;
}
html[data-ink-skin] ::-webkit-scrollbar-thumb {
  background-color: var(--dsh-scrollbar-thumb);
  border-radius: 999px;
}
`

    /** 水墨皮肤的字体、圆角与纸感。 */
    const TYPE_CSS_INK = `
html[data-ink-skin="ink"] body {
  --dsh-font-family-text-default: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", "SimSun", "Noto Serif", Georgia, ui-serif, serif;
  --dsw-font-family-brand: "Kaiti SC", "KaiTi", "STKaiti", "FangSong", "SimSun", serif;
  --dsw-radius-xs: 2px;
  --dsw-radius-sm: 4px;
  --dsw-radius-md: 6px;
  --dsw-radius-lg: 9px;
  --dsw-radius-xl: 12px;
  --dsw-radius-panel: 16px;
  --dsl-web-radius: 9px;
  --dsl-code-block-border-radius: 7px;
  --dsl-search-radius: 4px;
  --dsl-terminal-radius: 6px;
  --dsw-shadow-lv1: 0 1px 2px 0 rgba(38, 30, 20, 0.06), 0 0 0 0.5px rgba(38, 30, 20, 0.05);
  --dsw-shadow-lv2: 0 2px 10px 0 rgba(38, 30, 20, 0.07), 0 0 0 0.5px rgba(38, 30, 20, 0.05);
  --dsw-shadow-lv3: 0 0 1px 0 rgba(38, 30, 20, 0.14), 0 10px 30px 0 rgba(38, 30, 20, 0.1);
  --dsw-elevation-stroke-color: rgba(38, 30, 20, 0.1);
  --dsh-scrollbar-width: 6px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1);
  /* Markdown headings arrive as a composite "font" shorthand, so a family
     token alone would not reach them — the shorthand itself has to be replaced. */
  --dsh-ink-display-font: "Kaiti SC", "KaiTi", "STKaiti", "FangSong", "Songti SC", serif;
  --dsw-font-markdown-h1: 500 calc(22px + var(--dsh-content-font-delta)) / calc(34px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h2: 500 calc(18px + var(--dsh-content-font-delta)) / calc(29px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h3: 500 calc(16px + var(--dsh-content-font-delta)) / calc(27px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h4: 500 var(--dsh-content-font-size, 14px) / calc(25px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  letter-spacing: 0.012em;
}
html[data-ink-skin="ink"][data-ink-tone="dark"] body {
  --dsw-shadow-lv1: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(236, 229, 216, 0.06);
  --dsw-shadow-lv2: 0 3px 14px 0 rgba(0, 0, 0, 0.44), 0 0 0 0.5px rgba(236, 229, 216, 0.06);
  --dsw-shadow-lv3: 0 0 1px 0 rgba(236, 229, 216, 0.16), 0 12px 34px 0 rgba(0, 0, 0, 0.5);
  --dsw-elevation-stroke-color: rgba(236, 229, 216, 0.14);
}
html[data-ink-skin="ink"] body {
  font-kerning: normal;
  text-rendering: optimizeLegibility;
}
html[data-ink-skin="ink"] body h1,
html[data-ink-skin="ink"] body h2 {
  font-family: "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", "SimSun", serif;
  letter-spacing: 0.04em;
}
html[data-ink-skin="ink"] body h3,
html[data-ink-skin="ink"] body h4 {
  letter-spacing: 0.03em;
}
html[data-ink-skin="ink"] ::selection {
  background: rgba(168, 54, 42, 0.18);
  color: inherit;
}
html[data-ink-skin="ink"][data-ink-tone="dark"] ::selection {
  background: rgba(198, 90, 61, 0.28);
}
`

    /** The scene container and its motion. */
    const SCENE_CSS_INK = `
#${SCENE_ID} {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  contain: paint;
  opacity: 0;
  transition: opacity 620ms ease-out;
  background: linear-gradient(180deg, #fffdf8, #f1ebe0);
}
html[data-ink-skin="ink"][data-ink-tone="dark"] #${SCENE_ID} {
  background: linear-gradient(180deg, #0a0f14, #1b2733);
}
#${SCENE_ID}[data-ready] { opacity: 1; }
#${SCENE_ID} .ink-art {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-position: 50% 100%;
  background-size: cover;
}
html[data-ink-skin="ink"][data-ink-tone="light"] #${SCENE_ID} .ink-art { background-image: url("${SCENE_ASSETS.dawn}"); }
html[data-ink-skin="ink"][data-ink-tone="dark"] #${SCENE_ID} .ink-art { background-image: url("${SCENE_ASSETS.night}"); }
html[data-ink-skin="ink"] #${SCENE_ID}[data-motion="on"] .ink-art {
  animation: ink-drift 68s ease-in-out infinite alternate;
  will-change: transform;
}
#${SCENE_ID} .ink-colophon {
  position: absolute;
  top: 15vh;
  right: 1.6vw;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  writing-mode: vertical-rl;
  font-family: "Kaiti SC", KaiTi, STKaiti, "Songti SC", serif;
  user-select: none;
}
#${SCENE_ID} .ink-colophon__verse {
  font-size: 13px;
  letter-spacing: 0.34em;
  color: rgba(52, 62, 70, 0.4);
  text-shadow: 0 0 12px rgba(255, 253, 246, 0.5);
}
#${SCENE_ID} .ink-colophon__seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  padding: 5px 0;
  border-radius: 2px;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  color: rgba(255, 250, 244, 0.92);
  background: rgba(168, 54, 42, 0.72);
}
html[data-ink-skin="ink"][data-ink-tone="dark"] #${SCENE_ID} .ink-colophon__verse {
  color: rgba(196, 214, 226, 0.38);
  text-shadow: 0 0 14px rgba(6, 10, 14, 0.7);
}
html[data-ink-skin="ink"][data-ink-tone="dark"] #${SCENE_ID} .ink-colophon__seal { background: rgba(198, 90, 61, 0.6); }
#${SCENE_ID} .ink-vignette {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
}
html[data-ink-skin="ink"][data-ink-tone="light"] #${SCENE_ID} .ink-vignette {
  background-image:
    radial-gradient(118% 96% at 50% 40%, rgba(255, 252, 244, 0) 46%, rgba(198, 182, 156, 0.22) 100%),
    linear-gradient(180deg, rgba(255, 252, 244, 0.22) 0%, rgba(255, 252, 244, 0) 16%);
}
html[data-ink-skin="ink"][data-ink-tone="dark"] #${SCENE_ID} .ink-vignette {
  background-image:
    radial-gradient(118% 96% at 50% 42%, rgba(8, 11, 14, 0) 40%, rgba(4, 6, 8, 0.66) 100%),
    linear-gradient(180deg, rgba(6, 9, 12, 0.4) 0%, rgba(6, 9, 12, 0) 24%);
}
@keyframes ink-drift {
  from { transform: translate3d(-0.7%, 0, 0) scale(1.03); }
  to { transform: translate3d(0.7%, -0.5%, 0) scale(1.03); }
}
@media (prefers-reduced-motion: reduce) {
  #${SCENE_ID} * {
    animation: none !important;
    transition: none !important;
  }
}
`

    /** 银河皮肤的字体系统：无衬线、紧字距、表格数字，与水墨的中式衬线明确区分。 */
    const TYPE_CSS_GALAXY = `
html[data-ink-skin="galaxy"] body {
  --dsh-font-family-text-default: "Inter", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --dsw-font-family-brand: "Inter", "Segoe UI", system-ui, sans-serif;
  --dsh-ink-display-font: "Inter", "Segoe UI", "PingFang SC", system-ui, sans-serif;
  --dsw-font-markdown-h1: 600 calc(21px + var(--dsh-content-font-delta)) / calc(31px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h2: 600 calc(18px + var(--dsh-content-font-delta)) / calc(27px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h3: 600 calc(15.5px + var(--dsh-content-font-delta)) / calc(25px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-font-markdown-h4: 600 var(--dsh-content-font-size, 14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsh-ink-display-font);
  --dsw-radius-xs: 3px;
  --dsw-radius-sm: 6px;
  --dsw-radius-md: 8px;
  --dsw-radius-lg: 11px;
  --dsw-radius-xl: 14px;
  --dsw-radius-panel: 18px;
  --dsl-web-radius: 8px;
  --dsl-code-block-border-radius: 8px;
  --dsl-search-radius: 6px;
  --dsl-terminal-radius: 8px;
  --dsw-shadow-lv1: 0 0 0 0.5px rgba(120, 180, 255, 0.14), 0 2px 10px rgba(2, 6, 16, 0.5);
  --dsw-shadow-lv2: 0 0 0 0.5px rgba(120, 180, 255, 0.18), 0 10px 30px rgba(2, 6, 16, 0.56);
  --dsw-shadow-lv3: 0 0 1px 0 rgba(150, 200, 255, 0.22), 0 14px 40px rgba(1, 4, 12, 0.62);
  --dsw-elevation-stroke-color: rgba(130, 180, 255, 0.18);
  --dsh-scrollbar-width: 8px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.008em;
  /* presenter 只写 documentElement 的内联 color-scheme，body 自己声明就能盖过继承值：
     深空底 + 原生浅色滚动条会很刺眼。 */
  color-scheme: dark;
}
html[data-ink-skin="galaxy"] body h1,
html[data-ink-skin="galaxy"] body h2,
html[data-ink-skin="galaxy"] body h3 {
  font-weight: 600;
  letter-spacing: 0.004em;
}
html[data-ink-skin="galaxy"] ::selection {
  background: rgba(111, 195, 255, 0.24);
  color: inherit;
}
html[data-ink-skin="galaxy"] ::-webkit-scrollbar-thumb {
  background-color: var(--dsh-scrollbar-thumb);
  border-radius: 999px;
}
`

    /**
     * 银河场景：一张烘焙星图 + 两片星尘平铺 + 辉光暗角 + 两处标注。
     * 动效只有 3 个元素（两片星尘位移、地球公转），全部走合成层，没有滤镜和 rAF。
     */
    const SCENE_CSS_GALAXY = `
html[data-ink-skin="galaxy"] #${SCENE_ID} {
  background: radial-gradient(120% 92% at 62% 34%, #16233a 0%, #0b1220 46%, #04070d 100%);
}
#${SCENE_ID} .gx-space {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-position: 50% 45%;
  background-size: cover;
}
html[data-ink-skin="galaxy"][data-ink-tone="light"] #${SCENE_ID} .gx-space { background-image: url("${SCENE_ASSETS.galaxyLight}"); }
html[data-ink-skin="galaxy"][data-ink-tone="dark"] #${SCENE_ID} .gx-space { background-image: url("${SCENE_ASSETS.galaxyDark}"); }

/* 星尘：两张透明星点瓦片，靠 translate3d 无缝循环漂移。 */
#${SCENE_ID} .gx-dust {
  position: absolute;
  inset: -14%;
  background-repeat: repeat;
  opacity: 0.85;
}
#${SCENE_ID} .gx-dust--far {
  background-image: url("${SCENE_ASSETS.starsFar}");
  background-size: 560px 560px;
  opacity: 0.3;
}
#${SCENE_ID} .gx-dust--near {
  background-image: url("${SCENE_ASSETS.starsNear}");
  background-size: 980px 980px;
  opacity: 0.42;
}
#${SCENE_ID}[data-motion="on"] .gx-dust--far {
  animation: gx-drift-far 340s linear infinite;
  will-change: transform;
}
#${SCENE_ID}[data-motion="on"] .gx-dust--near {
  animation: gx-drift-near 190s linear infinite;
  will-change: transform;
}
@keyframes gx-drift-far {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-560px, -280px, 0); }
}
@keyframes gx-drift-near {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(980px, 392px, 0); }
}

/* 闪烁：第三张瓦片只做整体 opacity 呼吸，不逐星改 DOM。 */
#${SCENE_ID} .gx-twinkle {
  position: absolute;
  inset: 0;
  background-image: url("${SCENE_ASSETS.starsTwinkle}");
  background-repeat: repeat;
  background-size: 720px 720px;
  opacity: 0.38;
  pointer-events: none;
  /* 单独提层：opacity 动画只让合成器动，不触发重绘。 */
  transform: translate3d(0, 0, 0);
}
#${SCENE_ID}[data-motion="on"] .gx-twinkle {
  animation: gx-twinkle 11s ease-in-out infinite;
  will-change: opacity;
}
@keyframes gx-twinkle {
  0%, 100% { opacity: 0.3; }
  46% { opacity: 0.72; }
  72% { opacity: 0.44; }
}

/* 流星：两条斜向流光，周期错开，只动 transform/opacity。 */
#${SCENE_ID} .gx-meteor {
  position: absolute;
  width: 190px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  /* 不用 filter：drop-shadow 会让每一帧都重算滤镜；光晕直接画进渐变里。 */
  background:
    linear-gradient(90deg, rgba(206, 232, 255, 0) 0%, rgba(232, 246, 255, 0.95) 52%, rgba(206, 232, 255, 0) 100%),
    linear-gradient(90deg, rgba(140, 196, 255, 0) 0%, rgba(140, 196, 255, 0.28) 52%, rgba(140, 196, 255, 0) 100%);
  background-size: 100% 1px, 100% 5px;
  background-position: 0 0, 0 -2px;
  background-repeat: no-repeat;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}
#${SCENE_ID} .gx-meteor--a { left: 16%; top: 14%; }
#${SCENE_ID} .gx-meteor--b { left: 62%; top: 7%; width: 130px; }
#${SCENE_ID}[data-motion="on"] .gx-meteor--a { animation: gx-meteor-a 13s ease-out infinite; }
#${SCENE_ID}[data-motion="on"] .gx-meteor--b { animation: gx-meteor-b 19s ease-out 6.5s infinite; }
@keyframes gx-meteor-a {
  0% { transform: rotate(24deg) translate3d(-40px, -20px, 0); opacity: 0; }
  3% { opacity: 0.95; }
  13% { opacity: 0; }
  100% { transform: rotate(24deg) translate3d(430px, 190px, 0); opacity: 0; }
}
@keyframes gx-meteor-b {
  0% { transform: rotate(19deg) translate3d(0, 0, 0); opacity: 0; }
  2.5% { opacity: 0.8; }
  11% { opacity: 0; }
  100% { transform: rotate(19deg) translate3d(320px, 130px, 0); opacity: 0; }
}

/* 素材署名：ESO CC BY 4.0 要求可见，因此常驻一行极淡的小字。 */
#${SCENE_ID} .gx-credit {
  position: absolute;
  left: 292px;
  bottom: 15px;
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: rgba(198, 216, 240, 0.38);
  pointer-events: none;
  user-select: none;
}

#${SCENE_ID} .gx-bloom {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(58% 48% at 72% 28%, rgba(120, 180, 255, 0.16) 0%, rgba(120, 180, 255, 0) 68%),
    radial-gradient(42% 34% at 26% 74%, rgba(150, 130, 255, 0.1) 0%, rgba(150, 130, 255, 0) 70%),
    radial-gradient(122% 100% at 50% 58%, rgba(2, 4, 10, 0) 38%, rgba(1, 3, 8, 0.74) 100%);
}

/* ---------- 标注：太阳系 ---------- */
#${SCENE_ID} .gx-mark {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
  user-select: none;
  font-family: "Inter", "Segoe UI", "PingFang SC", system-ui, sans-serif;
  color: rgba(226, 240, 255, 0.92);
  text-shadow: 0 0 14px rgba(4, 10, 22, 0.85);
}
#${SCENE_ID} .gx-mark--sol { left: 73%; top: 29%; }
#${SCENE_ID} .gx-sol {
  position: relative;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fffaf0 0 3.4px, rgba(255, 226, 160, 0.62) 5px, rgba(255, 208, 128, 0) 62%);
}
#${SCENE_ID} .gx-sol::before,
#${SCENE_ID} .gx-sol::after {
  content: "";
  position: absolute;
  inset: 50% -4px auto;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 236, 190, 0), rgba(255, 244, 214, 0.95), rgba(255, 236, 190, 0));
  transform: translateY(-50%);
}
#${SCENE_ID} .gx-sol::after { transform: translateY(-50%) rotate(90deg); }
#${SCENE_ID} .gx-sol__pulse {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 0.5px solid rgba(255, 226, 160, 0.4);
}
#${SCENE_ID}[data-motion="on"] .gx-sol__pulse { animation: gx-pulse 7s ease-in-out infinite; }
@keyframes gx-pulse {
  0%, 100% { transform: scale(0.9); opacity: 0.55; }
  50% { transform: scale(1.18); opacity: 0.16; }
}
#${SCENE_ID} .gx-text { display: flex; flex-direction: column; gap: 3px; }
#${SCENE_ID} .gx-text__name {
  font-size: 12.5px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(214, 234, 255, 0.95);
}
#${SCENE_ID} .gx-text__sub {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: rgba(176, 200, 228, 0.72);
}

/* ---------- 标注：地球（放大镜） ---------- */
#${SCENE_ID} .gx-mark--earth {
  left: max(300px, 20%);
  bottom: 17%;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
#${SCENE_ID} .gx-lens {
  position: absolute;
  inset: 0;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  border: 0.5px solid rgba(150, 200, 255, 0.35);
  background: radial-gradient(circle at 50% 50%, rgba(12, 24, 44, 0.72) 0%, rgba(6, 12, 24, 0.5) 70%, rgba(6, 12, 24, 0.2) 100%);
  box-shadow: 0 0 30px rgba(60, 120, 200, 0.18), inset 0 0 24px rgba(40, 90, 160, 0.24);
}
#${SCENE_ID} .gx-lens__sun {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 13px;
  height: 13px;
  margin: -6.5px 0 0 -6.5px;
  border-radius: 50%;
  background: radial-gradient(circle at 42% 38%, #fff8e2 0%, #ffd98a 46%, #f2a83c 100%);
  box-shadow: 0 0 12px rgba(255, 206, 120, 0.8);
}
/* 外壳可能把 div 的圆角规整成方角：圆形一律再用 clip-path 兜一层。 */
#${SCENE_ID} .gx-lens,
#${SCENE_ID} .gx-sol,
#${SCENE_ID} .gx-sol__pulse,
#${SCENE_ID} .gx-lens__sun,
#${SCENE_ID} .gx-lens__earth {
  clip-path: circle(50% at 50% 50%);
}
#${SCENE_ID} .gx-lens__rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
#${SCENE_ID} .gx-lens__spin {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
#${SCENE_ID}[data-motion="on"] .gx-lens__spin { animation: gx-orbit 36s linear infinite; }
@keyframes gx-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
#${SCENE_ID} .gx-lens__earth {
  position: absolute;
  /* 行星必须落在最外圈轨道（r=48/132）上、而不是镜片边缘：
     镜片有 clip-path: circle(50%)，贴边的点会被切掉一半（曾经的 bug）。 */
  top: calc(50% - 48px);
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #a8e2ff 0%, #4f9fe0 52%, #1f4f80 100%);
  box-shadow: 0 0 10px rgba(110, 190, 255, 0.85), 0 0 22px rgba(80, 150, 240, 0.4);
}
/* 地球本身不跟着轨道自转（否则会转歪），反向自转抵消。 */
#${SCENE_ID}[data-motion="on"] .gx-lens__earth { animation: gx-orbit-counter 36s linear infinite; }
@keyframes gx-orbit-counter { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
#${SCENE_ID} .gx-lens__wrap { position: relative; width: 132px; height: 132px; flex: none; }
#${SCENE_ID} .gx-lens__leader {
  position: absolute;
  left: 50%;
  top: 100%;
  width: 0.5px;
  height: 18px;
  background: linear-gradient(180deg, rgba(150, 200, 255, 0.5), rgba(150, 200, 255, 0));
}

/* ---------- 题字 ---------- */
#${SCENE_ID} .gx-caption {
  position: absolute;
  top: 15vh;
  right: 1.6vw;
  writing-mode: vertical-rl;
  font-family: "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", serif;
  font-size: 13px;
  letter-spacing: 0.34em;
  color: rgba(196, 214, 236, 0.4);
  text-shadow: 0 0 14px rgba(4, 8, 16, 0.8);
  user-select: none;
}
@media (prefers-reduced-motion: reduce) {
  #${SCENE_ID} * {
    animation: none !important;
    transition: none !important;
  }
}
`

    /**
     * 外壳着色：侧栏与顶栏是 shell 自己的 div/header，类名是哈希，只能靠运行时
     * 打的 [data-ink-sidebar] / [data-ink-header] 标记命中。
     */
    const SHELL_CSS = `
html[data-ink-skin] [data-ink-sidebar] {
  background-image: linear-gradient(
    180deg,
    var(--ink-shell-wash-top) 0%,
    rgba(0, 0, 0, 0) 22%,
    rgba(0, 0, 0, 0) 76%,
    var(--ink-shell-wash-bottom) 100%
  );
  box-shadow: inset -0.5px 0 0 var(--ink-shell-rule);
}
html[data-ink-skin] [data-ink-header] {
  /* 天头：中间偏上的柔和"天光"，而不是一条平铺的色带 */
  background-image: radial-gradient(130% 180% at 50% -60%, var(--ink-head-glow) 0%, rgba(0, 0, 0, 0) 58%);
  box-shadow:
    inset 0 1px 0 var(--ink-head-accent),
    inset 0 -0.5px 0 var(--ink-shell-rule);
}
/* 右上角（会话标题栏的窗口按钮区）再压一层同色，避免和正文抢视线 */
html[data-ink-skin] [data-conversation-header-corner] {
  background-image: radial-gradient(120% 200% at 100% -40%, var(--ink-head-glow) 0%, rgba(0, 0, 0, 0) 70%);
}
`

    /** Settings row + seal, styled from the active theme's own tokens. */
    const CHROME_CSS = `
.ink-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 2px 0; }
.ink-row__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ink-row__title { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); letter-spacing: 0.04em; }
.ink-row__hint { font-size: 11.5px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.ink-row__controls { display: flex; align-items: center; gap: 10px; flex: none; }
.ink-seg {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, transparent);
}
.ink-seg__btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 120ms ease-out, color 120ms ease-out;
  white-space: nowrap;
}
.ink-seg__btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ink-seg__btn[aria-pressed="true"] {
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 0.5px var(--dsw-alias-border-l3), 0 1px 2px rgba(38, 30, 20, 0.08);
}
.ink-toggle {
  appearance: none;
  border: 0;
  padding: 0;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 32%, transparent);
  position: relative;
  cursor: pointer;
  transition: background-color 160ms ease-out;
  flex: none;
}
.ink-toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-switch-thumb);
  box-shadow: 0 1px 2px rgba(20, 16, 12, 0.28);
  transition: transform 160ms ease-out;
}
.ink-toggle[aria-pressed="true"] { background: var(--dsw-alias-brand-primary); }
.ink-toggle[aria-pressed="true"]::after { transform: translateX(14px); }
.ink-seal {
  display: grid;
  place-items: center;
  border-radius: 3px;
  background: linear-gradient(158deg, #b23f2c 0%, #9c2f22 58%, #8d2a1e 100%);
  box-shadow: inset 0 0 0 1.5px rgba(255, 246, 232, 0.82), inset 0 0 0 3.5px rgba(178, 63, 44, 0.55), 0 1px 2px rgba(60, 20, 12, 0.28);
  color: #fdf3e2;
  font-family: "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", serif;
  line-height: 1;
  user-select: none;
  overflow: hidden;
  transform: rotate(-1.6deg);
  position: relative;
  isolation: isolate;
}
.ink-seal::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(41deg, rgba(255, 246, 232, 0.14) 0 1px, transparent 1px 3px);
  opacity: 0.5;
  pointer-events: none;
}
.ink-seal__chars {
  display: grid;
  place-items: center;
  font-weight: 500;
  letter-spacing: 0;
  text-shadow: 0 0 1px rgba(80, 20, 10, 0.5);
}
.ink-brand { display: inline-flex; align-items: baseline; gap: 7px; min-width: 0; }
.ink-brand__han {
  font-family: "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", serif;
  font-size: 15px;
  letter-spacing: 0.22em;
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
}
.ink-brand__latin {
  font-family: "Optima", "Times New Roman", serif;
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.ink-brand--star .ink-brand__han {
  font-family: "Inter", "Segoe UI", "PingFang SC", system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.16em;
}
.ink-brand--star .ink-brand__latin {
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.2em;
}
/* 星芒标记：一团柔光 + 两道细十字芒，和水墨印章共用同一个插槽尺寸。 */
.ink-mark--star {
  position: relative;
  flex: none;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, rgba(214, 238, 255, 0.95) 0 16%, rgba(111, 195, 255, 0.55) 34%, rgba(111, 195, 255, 0) 68%);
  box-shadow: 0 0 10px rgba(111, 195, 255, 0.45);
  isolation: isolate;
}
.ink-mark--star::before,
.ink-mark--star::after {
  content: "";
  position: absolute;
  border-radius: 50%;
}
.ink-mark--star::before {
  inset: 6% 47%;
  background: linear-gradient(180deg, rgba(214, 238, 255, 0), rgba(214, 238, 255, 0.9) 45%, rgba(214, 238, 255, 0));
}
.ink-mark--star::after {
  inset: 47% 6%;
  background: linear-gradient(90deg, rgba(214, 238, 255, 0), rgba(214, 238, 255, 0.9) 45%, rgba(214, 238, 255, 0));
}
.ink-toggle[disabled] { opacity: 0.35; cursor: default; }
`

    /** Install one owned stylesheet; disposed with the plugin fiber. */
    function installStyle(ctx, name, css) {
      ctx.effect(() => {
        // Re-applying (HMR, a second fiber) must not stack stylesheets: a
        // duplicated scene stylesheet is enough to make the UI flash.
        for (const stale of document.querySelectorAll(`style[data-plugin-css="${PLUGIN_ID}/${name}"]`)) stale.remove()
        const tag = document.createElement('style')
        tag.dataset.plugin = PLUGIN_ID
        tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`
        tag.textContent = css
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, `${PLUGIN_ID}: ${name} stylesheet`)
    }

    /* ------------------------------------------------------------------ *
     * 3. Scene layer
     * ------------------------------------------------------------------ */

/**
     * Build the fixed landscape: one raster layer, the vignette, and the
     * vertical 题款. Appended to <html> so that its negative z-index paints
     * above the canvas background (the propagated body fill) and behind every
     * app surface.
     * @returns the scene handle.
     */
    /**
     * 水墨场景：一张烘焙宣纸底图 + 暗角 + 竖排题款。挂到 <html> 上，
     * 负 z-index 会画在画布背景之上、所有面板之下。
     * @returns 场景句柄（root 用于挂载/卸载，family 供切换时比对）。
     */
    function createInkScene() {
      const root = document.createElement('div')
      root.id = SCENE_ID
      root.dataset.skin = SKIN_INK
      root.setAttribute('aria-hidden', 'true')
      const art = document.createElement('div')
      art.className = 'ink-art'
      const vignette = document.createElement('div')
      vignette.className = 'ink-vignette'
      const colophon = document.createElement('div')
      colophon.className = 'ink-colophon'
      const verse = document.createElement('span')
      verse.className = 'ink-colophon__verse'
      verse.textContent = '溪山無盡　烟嵐出沒'
      const sign = document.createElement('span')
      sign.className = 'ink-colophon__seal'
      sign.textContent = '溪山'
      colophon.append(verse, sign)
      root.append(art, vignette, colophon)
      return { root, family: SKIN_INK }
    }

    /** 小工具：造一个带 class 的 div。 */
    function div(className, text) {
      const el = document.createElement('div')
      el.className = className
      if (text !== undefined) el.textContent = text
      return el
    }

    /**
     * 银河场景：烘焙星图 + 两片星尘 + 辉光暗角 + 两处标注（太阳系 / 地球）。
     * 标注是纯 DOM，不参与动画，所以在动效关闭时依然完整可读。
     * @returns 场景句柄。
     */
    function createGalaxyScene() {
      const root = document.createElement('div')
      root.id = SCENE_ID
      root.dataset.skin = SKIN_GALAXY
      root.setAttribute('aria-hidden', 'true')

      const space = div('gx-space')
      const dustFar = div('gx-dust gx-dust--far')
      const dustNear = div('gx-dust gx-dust--near')
      const twinkle = div('gx-twinkle')
      const bloom = div('gx-bloom')
      // 流星：两个周期错开的纯 transform/opacity 元素
      const meteorA = div('gx-meteor gx-meteor--a')
      const meteorB = div('gx-meteor gx-meteor--b')
      // ESO 素材署名（CC BY 4.0 要求清晰可见）
      const credit = div('gx-credit', 'ESO / S. Brunier · CC BY 4.0')

      // 太阳系：银河带上的一处亮点，外加十字星芒与一圈呼吸环。
      const sol = div('gx-mark gx-mark--sol')
      const solStar = div('gx-sol')
      solStar.append(div('gx-sol__pulse'))
      const solText = div('gx-text')
      solText.append(
        div('gx-text__name', '太阳系'),
        div('gx-text__sub', '猎户臂 · 距银心约 2.6 万光年'),
      )
      sol.append(solStar, solText)

      // 地球：放大镜里的太阳系示意，第三颗行星就是地球。
      const earth = div('gx-mark gx-mark--earth')
      const lens = div('gx-lens')
      const spin = div('gx-lens__spin')
      spin.append(div('gx-lens__earth'))
      // 轨道用内联 SVG 画圆：CSS 圆环在某些外壳样式下会被方角化，svg 不会。
      const rings = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      rings.setAttribute('class', 'gx-lens__rings')
      rings.setAttribute('viewBox', '0 0 132 132')
      for (const [r, alpha] of [
        [17, 0.24],
        [31, 0.26],
        [48, 0.34],
      ]) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        ring.setAttribute('cx', '66')
        ring.setAttribute('cy', '66')
        ring.setAttribute('r', String(r))
        ring.setAttribute('fill', 'none')
        ring.setAttribute('stroke', `rgba(150, 200, 255, ${alpha})`)
        ring.setAttribute('stroke-width', '0.5')
        rings.append(ring)
      }
      const lensWrap = div('gx-lens__wrap')
      lensWrap.append(lens, div('gx-lens__leader'))
      lens.append(div('gx-lens__sun'), rings, spin)
      const earthText = div('gx-text')
      earthText.append(div('gx-text__name', '地球'), div('gx-text__sub', '太阳系第三行星 · 迄今唯一的家'))
      earth.append(lensWrap, earthText)

      const caption = div('gx-caption', '銀河懸天　群星如塵')

      root.append(space, dustFar, dustNear, twinkle, bloom, meteorA, meteorB, sol, earth, caption, credit)
      return { root, family: SKIN_GALAXY }
    }

    /* ------------------------------------------------------------------ *
     * 3.5 Skin registry
     * ------------------------------------------------------------------ */

    /**
     * 皮肤注册表：一套皮肤 = 两组 palette + 两张底图 + 一个场景构造器 + 品牌文案。
     * 新增皮肤只要在这里加一项，设置行的选项会自动多一个。
     */
    const SKINS = {
      [SKIN_INK]: {
        id: SKIN_INK,
        label: '山水',
        palettes: { light: PALETTE.dawn, dark: PALETTE.night },
        assets: { light: SCENE_ASSETS.dawn, dark: SCENE_ASSETS.night },
        create: createInkScene,
        brand: { mark: 'seal', han: '溪山书斋', latin: 'Ink Landscape' },
      },
      [SKIN_GALAXY]: {
        id: SKIN_GALAXY,
        label: '银河',
        palettes: { light: PALETTE.galaxyDeep, dark: PALETTE.galaxyVoid },
        assets: { light: SCENE_ASSETS.galaxyLight, dark: SCENE_ASSETS.galaxyDark },
        create: createGalaxyScene,
        brand: { mark: 'star', han: '星河渡', latin: 'Milky Way' },
      },
    }

    /* ------------------------------------------------------------------ *
     * 4. React occupants
     * ------------------------------------------------------------------ */

    // 品牌要跟着皮肤换（印章 ↔ 星芒），所以用一个订阅表把当前家族广播出去。
    let activeFamily = SKIN_DEFAULT
    const brandListeners = new Set()

    /** 订阅当前皮肤家族；皮肤一变，品牌组件就重渲染。 */
    function useFamily() {
      const [family, setFamily] = React.useState(activeFamily)
      React.useEffect(() => {
        brandListeners.add(setFamily)
        setFamily(activeFamily)
        return () => brandListeners.delete(setFamily)
      }, [])
      return family
    }

    function announceFamily(family) {
      activeFamily = family
      for (const fn of brandListeners) {
        try {
          fn(family)
        } catch {
          /* 一个订阅者失败不影响其他 */
        }
      }
    }

    /** 侧栏品牌标记：水墨 = 朱砂印章（山水），银河 = 星芒。 */
    function SealMark(props) {
      const size = typeof props?.size === 'number' ? props.size : 24
      const family = useFamily()
      const brand = (SKINS[family] ?? SKINS[SKIN_INK]).brand
      if (family === SKIN_GALAXY) {
        return React.createElement('div', {
          className: 'ink-mark ink-mark--star',
          style: { width: `${size}px`, height: `${size}px` },
          title: brand.han,
          'aria-label': brand.han,
        })
      }
      const font = Math.max(9, Math.round(size * 0.42))
      return React.createElement(
        'div',
        { className: 'ink-seal', style: { width: `${size}px`, height: `${size}px` }, title: brand.han },
        React.createElement(
          'span',
          { className: 'ink-seal__chars', style: { fontSize: `${font}px` } },
          React.createElement('span', null, '山'),
          React.createElement('span', null, '水'),
        ),
      )
    }

    /** 题字 brand name：随皮肤切换文案。 */
    function BrandName() {
      const family = useFamily()
      const brand = (SKINS[family] ?? SKINS[SKIN_INK]).brand
      return React.createElement(
        'span',
        { className: `ink-brand ink-brand--${brand.mark}` },
        React.createElement('span', { className: 'ink-brand__han' }, brand.han),
        React.createElement('span', { className: 'ink-brand__latin' }, brand.latin),
      )
    }

    /* ---- 持久化 ---------------------------------------------------------- */

    /** 当前选中的皮肤家族；缺省时沿用 0.1.x 的 on/off 开关。 */
    function readSkin() {
      try {
        const saved = window.localStorage.getItem(`${STORE_KEY}:skin`)
        if (saved === SKIN_DEFAULT || SKINS[saved] !== undefined) return saved
        return window.localStorage.getItem(`${STORE_KEY}:enabled`) === 'off' ? SKIN_DEFAULT : SKIN_INK
      } catch {
        return SKIN_INK
      }
    }

    function writeSkin(id) {
      try {
        window.localStorage.setItem(`${STORE_KEY}:skin`, id)
      } catch {
        /* ignore */
      }
    }

    function readMotion() {
      try {
        // 默认开：动效只动 transform/opacity（合成器线程），实测空闲 3 s 仅 ~5 ms
        // 主线程时间；用户可在设置里关掉，`prefers-reduced-motion` 也会全局压掉。
        return window.localStorage.getItem(`${STORE_KEY}:motion`) !== 'off'
      } catch {
        return true
      }
    }

    function writeMotion(on) {
      try {
        window.localStorage.setItem(`${STORE_KEY}:motion`, on ? 'on' : 'off')
      } catch {
        /* ignore */
      }
    }

    /* ---- 设置行 ---------------------------------------------------------- */

    /**
     * 一行「皮肤主题」：原皮肤 / 山水 / 银河，外加一个背景动效开关。
     * 深度跟随应用本身的浅色/深色，所以行内只报当前色调，不提供换色。
     * @param props - Owner passes no props; `skin` is the injection face.
     */
    function SkinRow(props) {
      const skin = props.skin
      const [, force] = React.useState(0)
      React.useEffect(() => skin.subscribe(() => force((n) => n + 1)), [skin])
      const state = skin.state()
      const options = [
        { id: SKIN_DEFAULT, label: '原皮肤' },
        { id: SKIN_INK, label: '山水' },
        { id: SKIN_GALAXY, label: '银河' },
      ]
      const hints = {
        [SKIN_DEFAULT]: 'DSH 默认外观 · 不使用额外皮肤',
        [SKIN_INK]: `沉浸式水墨山水 · 宣纸质感 · 远山烟岚（${
          state.tone === TONE_DARK ? '夜山浓墨' : '宣纸晨岚'
        }）`,
        [SKIN_GALAXY]: `银河系星图 · 太阳系 / 地球标注 · 星尘缓慢运行（${
          state.tone === TONE_DARK ? '子夜银河' : '暮色深空'
        }）`,
      }
      const motionLabel = '背景动效'
      return React.createElement(
        'div',
        { className: 'ink-row' },
        React.createElement(
          'div',
          { className: 'ink-row__text' },
          React.createElement('div', { className: 'ink-row__title' }, '皮肤主题'),
          React.createElement('div', { className: 'ink-row__hint' }, hints[state.family] ?? hints[SKIN_DEFAULT]),
        ),
        React.createElement(
          'div',
          { className: 'ink-row__controls' },
          React.createElement(
            'div',
            { className: 'ink-seg', role: 'group', 'aria-label': '皮肤主题' },
            options.map((option) =>
              React.createElement(
                'button',
                {
                  key: option.id,
                  type: 'button',
                  className: 'ink-seg__btn',
                  'aria-pressed': state.family === option.id,
                  onClick: () => skin.setFamily(option.id),
                },
                option.label,
              ),
            ),
          ),
          React.createElement('button', {
            type: 'button',
            className: 'ink-toggle',
            title: state.motion ? `关闭${motionLabel}` : `开启${motionLabel}`,
            'aria-label': motionLabel,
            'aria-pressed': state.motion,
            disabled: state.family === SKIN_DEFAULT,
            onClick: () => skin.setMotion(!state.motion),
          }),
        ),
      )
    }

    /* ------------------------------------------------------------------ *
     * 5. Plugin body
     * ------------------------------------------------------------------ */

    const inject = ['theme', 'slots']

    /**
     * 一套皮肤的 token 层：把两种色调各自展开成 `{ light, dark }`，
     * 交给 `theme.overrideTokens` 压在当前主题上（不写偏好，也就不会被回滚）。
     * @param skin - 注册表里的一项。
     */
    function tokenPairs(skin) {
      const light = tokens(skin.palettes.light)
      const dark = tokens(skin.palettes.dark)
      const names = new Set([...Object.keys(light), ...Object.keys(dark)])
      const pairs = {}
      for (const name of names) {
        const l = light[name] ?? dark[name]
        const d = dark[name] ?? light[name]
        if (typeof l === 'string' && typeof d === 'string') pairs[name] = { light: l, dark: d }
      }
      return pairs
    }

    /**
     * 挂载皮肤：token 层 + 场景层 + 设置行 + 品牌。
     *
     * 皮肤不注册 theme：`setTheme` 会经 settings scope 写偏好，scope 拥有合法 id
     * 列表，外来 id 会在下一次 adopt 时被改回去。`overrideTokens` 才是留下的缝。
     *
     * @param ctx - Client root context (theme and slots services are available).
     */
    function apply(ctx) {
      const theme = ctx.theme

      const listeners = new Set()
      const notify = () => {
        for (const fn of listeners) {
          try {
            fn()
          } catch {
            /* one failing subscriber must not break the others */
          }
        }
      }

      // One stylesheet for every skin: switching skins must not churn <style>.
      installStyle(
        ctx,
        'skin',
        [BASE_CSS, TYPE_CSS_INK, TYPE_CSS_GALAXY, SCENE_CSS_INK, SCENE_CSS_GALAXY, SHELL_CSS, CHROME_CSS].join('\n'),
      )

      const toneNow = () => (theme.getTheme().active.colorScheme === 'dark' ? TONE_DARK : TONE_LIGHT)

      let motion = readMotion()
      let family = readSkin()

      // ---- token layer ------------------------------------------------------
      let releaseTokens
      const detachTokens = () => {
        if (releaseTokens === undefined) return
        releaseTokens()
        releaseTokens = undefined
      }
      const attachTokens = (skin) => {
        detachTokens()
        releaseTokens = theme.overrideTokens(PLUGIN_ID, tokenPairs(skin))
      }

      // ---- scene lifecycle --------------------------------------------------
      let scene
      let pending = 0
      /** 首帧是否已经挂过一次场景（首挂同步、后续让帧）。 */
      let mountedOnce = false

      const applyMotion = () => {
        if (scene) scene.root.dataset.motion = motion ? 'on' : 'off'
      }

      const clearScene = () => {
        if (!scene) return
        scene.root.remove()
        scene = undefined
      }

      const unmountScene = () => {
        clearScene()
        delete document.documentElement.dataset.inkSkin
        delete document.documentElement.dataset.inkTone
      }

      const buildScene = (id) => {
        if (family !== id) return
        clearScene()
        for (const stray of document.querySelectorAll(`#${SCENE_ID}`)) stray.remove()
        const skin = SKINS[id]
        if (!skin) return
        scene = skin.create()
        document.documentElement.appendChild(scene.root)
        applyMotion()
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
        raf(() => {
          if (scene && scene.family === id) scene.root.setAttribute('data-ready', '')
        })
      }

      /**
       * 首次挂载是同步的，之后才让帧。
       *
       * 早先一律「下一帧 + 空闲」再做，本意是别打断首帧；实测却发现启动时 shell
       * 自己有一段 400 ms 左右的长任务，让帧的结果是皮肤排在它后面 —— 用户先看到
       * 一瞬没有皮肤的界面（实测晚 ~470 ms），比省下那十几毫秒明显得多。
       * 建一层 11 个 div（+ 一张已预热的图）本身很便宜，所以首挂就顺手做掉；
       * 真正需要让帧的是「切皮肤」那种重排。
       */
      const scheduleScene = (id) => {
        const token = ++pending
        if (mountedOnce !== true) {
          mountedOnce = true
          if (family === id) buildScene(id)
          return
        }
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
        raf(() => {
          if (token !== pending || family !== id) return
          const run = () => {
            if (token === pending && family === id) buildScene(id)
          }
          // 只让出一帧：timeout 把上限压到 200 ms，启动慢的机器上也不会等满一秒。
          if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 200 })
          else setTimeout(run, 120)
        })
      }

      /** Warm the image cache for one skin/tone pair; the raster is the only download. */
      const preload = (skin, tone, rel) => {
        const key = `${skin.id}:${tone}`
        if (document.head.querySelector(`link[data-plugin="${PLUGIN_ID}"][data-ink-preload="${key}"]`)) return
        const link = document.createElement('link')
        link.rel = rel
        link.as = 'image'
        link.href = skin.assets[tone]
        link.dataset.plugin = PLUGIN_ID
        link.dataset.inkPreload = key
        document.head.appendChild(link)
      }

      /* ---- shell tagging ---------------------------------------------------
       * 侧栏与顶栏没有稳定的 data-* 钩子（类名是 CSS-module 哈希），只能在运行时
       * 找到它们并打上自己的标记，CSS 才命中得到。侧栏唯一稳定的锚点是滚动容器
       * [data-sidebar-scrollport]；顶栏是带 data-window-drag 的 header。
       */
      const tagShell = () => {
        const port = document.querySelector('[data-sidebar-scrollport]')
        const column = port === null ? null : port.parentElement
        if (column !== null && column.dataset.inkSidebar === undefined) column.dataset.inkSidebar = ''
        for (const el of document.querySelectorAll('[data-window-drag="true"]')) {
          if (el.dataset.inkHeader === undefined) el.dataset.inkHeader = ''
        }
      }
      const untagShell = () => {
        for (const el of document.querySelectorAll('[data-ink-sidebar], [data-ink-header]')) {
          delete el.dataset.inkSidebar
          delete el.dataset.inkHeader
        }
      }
      /** 外壳是异步长出来的：给几次便宜的补打，不做 MutationObserver。 */
      const tagShellSoon = () => {
        tagShell()
        for (const delay of [180, 600, 1400]) setTimeout(tagShell, delay)
      }

      // ---- selection --------------------------------------------------------
      const applySelection = (forceRebuild) => {
        const skin = SKINS[family]
        announceFamily(family)
        if (!skin) {
          // 原皮肤：完全退出，连属性和品牌占位都不留，DSH 逐像素回到默认。
          detachTokens()
          unmountBrand()
          pending += 1
          untagShell()
          unmountScene()
          notify()
          return
        }
        mountBrand()
        attachTokens(skin)
        document.documentElement.dataset.inkSkin = skin.id
        document.documentElement.dataset.inkTone = toneNow()
        preload(skin, toneNow(), 'preload')
        tagShellSoon()
        if (forceRebuild === true || !scene || scene.family !== skin.id) {
          pending += 1
          clearScene() // 立刻撤掉旧皮肤，切过去没有残影
          scheduleScene(skin.id)
        } else {
          applyMotion()
        }
        notify()
      }

      ctx.on('theme/change', () => {
        if (!SKINS[family]) return
        document.documentElement.dataset.inkTone = toneNow()
        preload(SKINS[family], toneNow(), 'preload')
        notify()
      })

      // ---- face for the appearance row --------------------------------------
      const skin = {
        state() {
          return { family, tone: toneNow(), motion }
        },
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        setFamily(id) {
          if (id !== SKIN_DEFAULT && SKINS[id] === undefined) return
          if (id === family) return
          family = id
          writeSkin(id)
          applySelection(true)
        },
        setMotion(on) {
          motion = Boolean(on)
          writeMotion(motion)
          applyMotion()
          notify()
        },
        /** 0.1.x 的兼容壳：预览页与旧调用点都还在用。 */
        setEnabled(on) {
          skin.setFamily(on ? SKIN_INK : SKIN_DEFAULT)
        },
      }

      // 另一档色调的图（约 160-230 KB）不再和首屏抢带宽：等界面安定之后再预热，
      // 那时翻「浅色/深色」仍然是瞬时的。省流量模式下干脆不预热。
      const warmTone = () => {
        const active = SKINS[family]
        if (!active) return
        if (navigator.connection?.saveData === true) return
        preload(active, toneNow() === TONE_DARK ? TONE_LIGHT : TONE_DARK, 'prefetch')
      }
      setTimeout(() => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(warmTone, { timeout: 4000 })
        else warmTone()
      }, 4000)

      // Handy for the offline preview harness (no effect on the real shell).
      if (module.exports.__art) module.exports.__art.skin = skin

      // ---- slot occupants --------------------------------------------------
      // Both brand slots are single slots already occupied by the shipped
      // brand. A single slot keeps one entry per priority, so shadowing it
      // means registering at a LOWER priority (lowest renders).
      //
      // 原皮肤 must NOT shadow the shipped mark, so these registrations are
      // disposable and only held while a skin is active.
      let brandDisposers = []
      const mountBrand = () => {
        if (brandDisposers.length > 0) return
        ctx.slots.inject('sidebar.brand.mark', () =>
          brandDisposers.push(
            ctx.slots.register({ name: 'sidebar.brand.mark', priority: -100 }, SealMark),
          ),
        )
        ctx.slots.inject('sidebar.brand.name', () =>
          brandDisposers.push(
            ctx.slots.register({ name: 'sidebar.brand.name', priority: -100 }, BrandName),
          ),
        )
      }
      const unmountBrand = () => {
        for (const dispose of brandDisposers) {
          try {
            dispose()
          } catch {
            /* slot already gone during teardown */
          }
        }
        brandDisposers = []
      }

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register({ name: 'settings.general.item', id: 'ink-landscape', order: 30 }, (props) =>
          React.createElement(SkinRow, { ...props, skin }),
        ),
      )

      // Slots exist now, so the first selection can also mount the brand.
      applySelection(false)

      ctx.effect(() => () => {
        pending += 1
        unmountBrand()
        unmountScene()
        detachTokens()
        listeners.clear()
        brandListeners.clear()
        for (const link of document.head.querySelectorAll(`link[data-plugin="${PLUGIN_ID}"][data-ink-preload]`)) {
          link.remove()
        }
      }, `${PLUGIN_ID}: scene teardown`)
    }

    module.exports.apply = apply
    module.exports.inject = inject
    module.exports.__art = { PALETTE, tokens, tokenPairs, SCENE_ASSETS, SKINS, SKIN_INK, SKIN_GALAXY, SKIN_DEFAULT }
    return module.exports
  },
})
