# 断环行动 · 寂静花园 / Operation Fracture

**这是 GPT-6.2 Astra 的模型能力测试产物，不是经过长期打磨的成熟正式产品。**  
**This is a GPT-6.2 Astra model-capability test artifact, not a finished or commercially polished product.**

本次公开的源码、离线网页与试玩视频来自一次模型测试交付（Drive 文件「断环行动-源码与试玩.zip」）。原包未提供测试提示词、推理参数、耗时或评测分数；本仓库也不编造这些信息。

The source, offline web build, and playtest video published here come from a model-capability test delivery (Google Drive file “断环行动-源码与试玩.zip”). The original package did not include the test prompt, sampling parameters, runtime, or scores; this repository does not invent them.

---

## 这是什么 / What this is

版本 **1.0.0**，一款可离线游玩的第一人称区域作战游戏，运行在支持 **WebGL 2** 的桌面浏览器中。公开标题为「断环行动 · 寂静花园」，英文名 **Operation Fracture**。源码使用 **Three.js 0.187.0**，构建工具为 **esbuild 0.28.2**。npm 包名 `exo-atlas-silent-garden` 只是内部名称，不是本仓库名。

Version **1.0.0** is an offline first-person skirmish game for desktop browsers with **WebGL 2**. The public title is 断环行动 · 寂静花园 / **Operation Fracture**. The source uses **Three.js 0.187.0** and is bundled with **esbuild 0.28.2**. The npm name `exo-atlas-silent-garden` is internal only and is not the repository name.

原使用说明已原样保留：[开始使用.md](开始使用.md)。依赖许可见 [`licenses/`](licenses/)。

The original play instructions are kept unchanged in [开始使用.md](开始使用.md). Dependency licenses are in [`licenses/`](licenses/).

## 如何试玩 / How to play

这是浏览器游戏，**没有** Windows / macOS / Linux 原生安装包，本仓库也不会为了凑齐桌面平台而改写游戏。

This is a browser game. There are **no** native Windows, macOS, or Linux installers, and the game will not be rewritten just to add those packages.

1. **在线页面（计划中的独立路径）:** <https://page.thweki.com:8443/fracture/>  
   该站点只在端口 **8443** 提供服务（不是 443）。公开站点发布由其他流程负责；**本次浏览器短烟测是在代理电脑的 `http://127.0.0.1:8870/fracture/` 完成的，不是用户的 Mac，也不代表公开 URL 已验证。** 这只是一次短烟测，**不是测试通过，也不是完整 QA。** 范围、未测事项和截图见 [TESTING.md](TESTING.md)。
2. **离线下载包:** 见 [GitHub Releases](https://github.com/Thweki/operation-fracture/releases)（预发布 / pre-release）中的 `Operation-Fracture-1.0.0-offline-web.zip`。解压后用支持 WebGL 2 的桌面浏览器打开 `dist/index.html`。场景、武器、音效和战区地图都打在这一份 HTML 里，可以离线打开。
3. **一分钟试玩视频:** Release 中的 `Fracture-60s.mp4`（1920×1080、30 fps、60 秒）。视频很大，**没有**进入 git 历史。

The planned isolated path is <https://page.thweki.com:8443/fracture/> (port **8443**, not 443). Public-site publication is handled separately. **The short browser smoke test was run on the publishing agent’s computer at `http://127.0.0.1:8870/fracture/`, not on the user’s Mac, and it does not verify the public URL.** It is **not a pass and not a complete QA.** Scope, untested items, and screenshots: [TESTING.md](TESTING.md).

主界面点击「投入战斗」开始。操作与音频设置在主界面右上角。原说明还写了从源码运行的方式：在 `source/` 使用 Node.js 24 与 `npm ci`、`npm test`、`npm run dev`（首次安装依赖需要联网）。本仓库发布过程**没有**执行这些脚本，也没有把它们的结果当作验证结论。

On the title screen, choose「投入战斗」to start. Controls and audio settings are at the top right. The original notes also describe a source workflow in `source/` with Node.js 24 (`npm ci`, `npm test`, `npm run dev`; the first install needs a network). Those scripts were **not** executed as part of this publication, and their results are not claimed here.

注意：`npm run build` 会写到 `source/dist/index.html`。本包提供的离线文件在仓库根目录的 [`dist/index.html`](dist/index.html)。

Note: `npm run build` writes `source/dist/index.html`. The offline file shipped here is [`dist/index.html`](dist/index.html) at the repository root.

## 许可 / Licensing

- Three.js：MIT（`licenses/three-LICENSE.txt`）
- esbuild：MIT（`licenses/esbuild-LICENSE.txt`）
- **本项目的原创源码、页面与资源没有附带项目级许可证。公开此仓库并不授予使用、修改或再分发这些原创内容的许可。** 第三方文件仍按其原许可条款。

There is **no project-level license** for the original source, page, and assets. Publishing this repository does not grant permission to use, modify, or redistribute that original content. Third-party files remain under their own licenses.

## 本仓库包含什么 / What is in this repo

- `source/`：游戏源码、样式、构建脚本、自动测试与锁文件
- `dist/index.html`：原包提供的单文件离线构建
- `开始使用.md`：原使用说明
- `licenses/`：第三方许可
- `CHANGES.md`：公开时的记录
- `TESTING.md`、`docs/browser-smoke-2026-11-18/`：2026-11-18 短烟测记录与事后验证截图（不是原包美术）
- 试玩视频只放在 Release，不进入 git 历史
