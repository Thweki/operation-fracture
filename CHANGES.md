# Changes / 变更记录

## 2026-11-18 — Initial public snapshot

- Source, `dist/index.html`, `开始使用.md`, and `licenses/` copied from `断环行动-源码与试玩.zip` (SHA-256 `19b80df8c4e018abd679b6122644481a0e256e69047ff4af5b99479ed7787e94`).
- The 60-second playtest video `video/Fracture-60s.mp4` was kept out of git history and published only as a Release asset.
- Added publication files only: `README.md`, `CHANGES.md`, `.gitignore`.
- `开始使用.md` and the original `source/` / `dist/index.html` / `licenses/` files were not modified for this commit.
- No native desktop installers were created.

- 源码、离线 HTML、原说明与第三方许可复制自上述 zip。
- 60 秒试玩视频不进入 git 历史，只作为 Release 资源。
- 本提交只增加公开说明文件，未改原说明、源码或 `dist/index.html`。
- 未制作原生桌面安装包。

## 2026-11-18 — Publication status

- Offline web package `Operation-Fracture-1.0.0-offline-web.zip` was attached to the pre-release. It is the original `dist/index.html` plus the original instructions and third-party licenses (SHA-256 `77909d7acab7319ca90103d2d6d1be9f113776a698354fd5519eb2e982994edf`).
- Public path `https://page.thweki.com:8443/fracture/` is the intended isolated location, but coordinated isolated deployment is still pending. Interactive play has not been browser-verified.

- 离线网页包已加入 Release。公开路径待协调隔离部署后再作为正式上线。交互游玩尚未经浏览器实测。

## 2026-11-18 — Short Web smoke test (docs only)

- Added [TESTING.md](TESTING.md) and later verification screenshots in `docs/browser-smoke-2026-11-18/`. No game source or `dist/index.html` was changed.
- Smoke test was on the publishing agent’s computer at `http://127.0.0.1:8870/fracture/`, not the user’s Mac, and not a verification of the public site URL.
- Observed: title and combat OK; W movement was not clearly confirmed; F showed a pulse beam and particles, with a recorded cooldown of about 7.9 seconds; refresh returned to the deploy title with no「继续」. Console: no errors. Audio and a full playthrough/QA were not tested. This is not a pass.

- 仅增加测试文档与事后截图，未改游戏源码或离线 HTML。短烟测不是通过结论。
