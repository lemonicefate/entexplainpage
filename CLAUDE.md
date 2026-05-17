# entexplainpage

診間病情溝通輔助 PWA — 衛教圖卡、手術流程、醫學計算機,Vanilla JS,部署於 GitHub Pages。

## 文件體系

本專案用 grill-with-docs skill 體系維護知識,不使用 gstack skills。各檔職責不重疊:

| 檔案 | 職責 |
|---|---|
| `CONTEXT.md` | 領域語彙(對領域專家有意義的術語) |
| `docs/adr/` | 架構決策記錄 |
| `TODOS.md` | 唯一的待辦追蹤(每筆自帶 Priority/What/Why/Context/Depends-on) |
| `CHANGELOG.md` | 已發布的變更(release 的 source of truth) |
| `CLAUDE.md` | 本檔 — 專案慣例與已知限制 |
| `README.md` | 給接手者的上手說明 |
| `DESIGN.md` | 設計系統與元件規格(色彩 token、元件 class、無障礙、資料格式);改 UI 同步更新 |

## 已知限制

- **admin.html 線上版無寫入能力** — GitHub Pages 是純靜態主機,跑不了 `scripts/admin.js` 提供的 `/api/*`。編輯衛教只能在 localhost(`npm run admin`)。線上版靠 hostname 偵測顯示 local-only 說明卡。
- **Service Worker 只在 production 生效** — 本機快取行為與線上不一致,debug 快取問題時要注意。

## 慣例

- **每次 bump `sw.js` 的 `CACHE_NAME` 後**,在 iPad Safari「加到主畫面」的 PWA 情境做一次回歸測試 — SW 快取更新在 iOS PWA 上行為特殊。
- 計算機是寫在 `js/app.js` 的靜態邏輯(不走 JSON);新增計算機的步驟見 `README.md`「新增計算機」。
- 「權威抄寫型」計算機規則(健保給付、國健署分級、藥典劑量)一律配 `tests/unit/calc/{id}.test.js` golden-file 測試鎖死;自創 / 估算公式不寫單元測試以免把 bug 變規格。詳見 `TODOS.md` 的 Calculator 測試策略。
- **CI gate(`.github/workflows/ci.yml`,2026-05-18 起)**:push 與 PR 自動跑 `unit`(vitest)與 `e2e`(playwright chromium)兩段 job,失敗時上傳 `playwright-report/` 為 artifact。Node 22 固定(Vite 7 要求 ≥ 22.12);同分支重 push 用 `concurrency.cancel-in-progress` 砍前一輪。本機 Node 若 < 22.12 (如 22.11) 須加 `NODE_OPTIONS='--experimental-require-module'` 跑 vitest。
