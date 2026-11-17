# 素材许可与来源（NOTICE）

本仓库 **代码** 以 MIT 发布（见 [LICENSE](LICENSE)）。以下 **图像素材** 不适用 MIT，按其原始许可分发（LICENSE 里那一份 MIT 只覆盖代码，不覆盖本节列出的图片）。

## 1. 银河皮肤底图 —— CC BY 4.0

`lib/assets/galaxy-light.webp`、`lib/assets/galaxy-dark.webp`

* 原作品：**ESO/S. Brunier — The Milky Way panorama**（GigaGalaxy Zoom，2009）
* 原始页面：<https://www.eso.org/public/images/eso0932a/>
* 许可：**Creative Commons Attribution 4.0 International (CC BY 4.0)**
  <https://creativecommons.org/licenses/by/4.0/>
  ESO 版权说明：<https://www.eso.org/public/copyright/>
* 本仓库的改动（CC BY 4.0 要求注明）：
  1. 从 6000×3000 全景中裁切出局部；
  2. 顺时针旋转 13°；
  3. 调整亮度（×0.64 / ×0.74）、对比度（×1.2 / ×1.14）、饱和度与轻微色相偏移；
  4. 叠加暖/冷两层氛围色与暗角；
  5. 重新编码为 2560×1440 WebP（质量 78）。
  上述处理的可复现源码在 `art/galaxy-photo.html` 与 `tools/bake-photo.mjs`。
* 署名：插件运行时会在场景左下角常驻一行
  `ESO / S. Brunier · CC BY 4.0`（`lib/client.js` 中的 `.gx-credit`）。
  如果你二次分发本插件，请保留该署名与本节说明。

> 如果你只想用代码、不想沿用这张照片：删掉 `lib/assets/galaxy-*.webp` 并用
> `art/galaxy-photo.html` 换上自己的素材重新烘焙即可（步骤见 README）。

## 2. 山水皮肤底图 —— MIT（本仓库原创）

`lib/assets/scene-dawn.webp`、`lib/assets/scene-night.webp`、
`lib/assets/starfield-*.webp`

由本仓库的 `art/scene.svg`（手写 SVG）与 `art/galaxy-gen.mjs`（程序化星点瓦片）
经 `tools/bake-art.mjs` 烘焙而成，随代码一并按 MIT 发布。

## 3. 字体

插件不打包任何字体文件，只声明字体族（宋体 / 楷体 / 系统衬线栈）。
若你的系统没有对应字体，浏览器会自动回落到 `serif`。
