# Testing / 测试记录

This is a record of what was actually tried after publication. It is **not** a pass, a full QA report, or a claim that the game is complete.

这是公开发布之后实际做过的测试记录，**不是**测试通过结论，也不是完整 QA。

## 2026-11-18 short Web smoke test / 短烟测

- **When:** 2026-11-18, about 09:11–09:13 America/New_York.
- **Where:** Desktop browser on the publishing agent’s computer, `http://127.0.0.1:8870/fracture/`. **Not** the user’s Mac, and **not** a test of the public `page.thweki.com` URL.
- **Build:** The published offline Web file (`dist/index.html` in `Operation-Fracture-1.0.0-offline-web.zip`).
- **Screenshots:** [docs/browser-smoke-2026-11-18/](docs/browser-smoke-2026-11-18/) (later verification shots; not original delivery art).

### Observed / 已观察到

- Title / deploy screen rendered normally (断环行动 · 寂静花园 / Operation Fracture,「投入战斗」, 当前部署 01 绯红前线, 0/5 战区).
- Entering battle reached the combat HUD (绯红前线, 第1/2波 · 已清除 0/11 in the combat screenshot).
- W movement was **not clearly confirmed**.
- Pressing F produced a pulse beam and particles. The smoke-test note recorded a cooldown of about **7.9 seconds**. The combat screenshot shows the beam and particles; this page does not treat 7.9 seconds as a fully measured timing study.
- After a browser refresh, the deploy title returned. The control was still「投入战斗」, with no「继续」, and the card still showed 0/5 战区.
- The tester reported **no errors** in the browser console.

### Not tested / 未测

- Audio / 音频
- Clear confirmation of W / other movement keys, mouse look, remaining weapons and skills, map, or pause
- A full mission, later districts, or a playthrough / 通关
- `npm ci` / `npm test` / `npm run dev` / `npm run build` (those scripts were still not run for this publication)
- The public site URL
- Long play, saves after finishing a fight, settings, accessibility, mobile, or other browsers

**Not a pass. Not a complete QA.**
