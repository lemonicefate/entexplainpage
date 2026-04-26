# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3.2] - 2026-04-26

### Fixed
- **線上 admin.html 顯示「Failed to fetch index」破圖** — GitHub Pages 是純靜態主機,跑不了 `scripts/admin.js` (Node) 提供的 `/api/*` endpoints,導致 `https://lemonicefate.github.io/entexplainpage/admin.html` 只會看到「無法載入」+ 空表單。線上版從來就無法真正寫入,寫入保護不變(沒有後端可寫),但 UI 看起來像壞掉。現在加上 hostname 偵測,非 localhost / 127.0.0.1 / ::1 直接顯示「此工具僅供診間本機編輯使用」說明卡 + 本機啟動指令 + 回主站連結;localhost 完全不受影響

## [0.2.3.1] - 2026-04-26

### Changed
- **解說圖片大幅放大** — 之前 `.player-frame` 強制 `aspect-ratio: 4/3` + `max-width: 900px` + 內部 32px padding，加上 stage 兩側 40px padding，導致 iPad 直立 768×1024 viewport 上圖片只佔 36%（約 624×452）。現在拿掉 frame 的 4:3 / 寬度上限 / 內 padding 與條紋背景，stage padding 歸零，讓 frame 滿版、`.slide-image` 用 `width:100% / height:100% + object-fit: contain` 填滿可用區域。圖片面積實測：chrome 顯示時提升至約 viewport 75%、Immersive 沉浸模式下 ~95%
- **Immersive 模式真正釋放版位** — 之前 `is-immersive` 只把 topbar / controls / scrubber `opacity: 0`，但版位還佔著、圖片不會變大。現在加上 `max-height: 0` + `padding: 0` 動畫，淡出時也收合掉空間，stage flex:1 自動長到滿版

## [0.2.3.0] - 2026-04-25

### Added
- **衛教管理可編輯與刪除** — `npm run admin` 之前只能新增，現在每篇衛教在列表多了「編輯 / 刪除」按鈕。編輯模式載入 title / category / steps、識別碼鎖定不可改，可改文字、替換單張步驟圖、增減步驟；後端 `PUT /api/procedures/:id` 儲存時自動回收沒被引用的舊圖檔。刪除為硬刪除：同步移除 `procedures/{id}.json`、`images/{id}/` 資料夾、`index.json` 條目
- **步驟拖拉排序** — 步驟卡片左上加 ≡ drag handle，HTML5 native drag-and-drop 任意調整順序，submit 時依目前 DOM 順序送出
- **編輯模式圖片預覽** — 步驟卡片顯示目前圖片縮圖 + 檔名，替換前可先確認；新上傳的圖以 `step{idx}-{timestamp}-{rand}.{ext}` 命名避免覆蓋衝突

### Changed
- **必填欄位調整** — 步驟標題、圖片設為必填；說明（description）改選填；無障礙描述（alt）欄位從 admin UI 移除（JSON schema 與既有資料保留），對診間內部 PWA 沒實際用處
- **admin server 新增路由** — `PUT /api/procedures/:id`（multipart payload + 可選圖片附件）、`DELETE /api/procedures/:id`；CORS `Access-Control-Allow-Methods` 加入 `PUT, DELETE`
- **admin 與主站共用同一個 port** — 之前 `npm run admin` 只跑 port 3001 admin server，但啟動訊息誤導印 `Main site: http://localhost:3000`，使用者打 3000 就會 connection refused（要再開一個 terminal 跑 `npm run serve`）。現在 admin.js 加上靜態檔 fallback：`http://localhost:3001/` 直接服務主站、`http://localhost:3001/admin.html` 進編輯器，單一指令搞定。`npm run serve` 仍保留給只想看主站時用

## [0.2.2.0] - 2026-04-25

### Added
- **畫筆（Pen）工具終於真的會畫** — v0.2.0.0 起上線的畫筆按鈕一直是空殼（handler 只處理 laser / spot），現改用 `<canvas>` + Pointer Events API 實作，iPad 手指、滑鼠、Apple Pencil 都支援。筆畫紅色 4px、retina 清晰（devicePixelRatio 處理）、換頁自動清空、關閉畫筆後筆畫保留（可關工具繼續對圖說明）

### Fixed
- **聚光燈半徑過窄** — 從 140px 半徑擴大到 `clamp(180px, 24vw, 280px)`，中央加 40% 完全透明 plateau 讓「亮區」有實際大小（不再是針點式聚焦）；桌面約 ~112px 亮核、手機 ~72px
- **雷射 / 聚光燈在 iPad 失效** — 原本只綁 `mousemove`，iOS Safari 對 `touchmove` 不會模擬 `mousemove`（手指移動完全不觸發）。改用 Pointer Events（`pointermove` + `pointerdown`）統一處理滑鼠、觸控、Pencil
- **雷射 / 聚光燈手指遮擋** — 觸控輸入時雷射點自動向上偏移 50px（iOS 長按放大鏡的同樣 UX 慣例），讓使用者看得到自己指哪。滑鼠、Pencil 不偏移（游標本身就精準）
- **Tool 模式下頁面滾動** — 在 `.tool-laser`/`.tool-spot`/`.tool-pen` 時設 `touch-action: none`，防止手指滑動不小心觸發 browser scroll 或 pinch-zoom

## [0.2.1.0] - 2026-04-25

### Added
- **Reader mode（電子書式沉浸閱讀）**：播放器左/中/右三區 tap navigation（上一頁 / 切換工具列 / 下一頁），進入播放後 3 秒自動隱藏工具列與返回按鈕，中央再 tap 恢復顯示，工具啟用中 tap zones 自動停用
- **手機版底部 scrubber（拖拉桿）**：`<input type=range>` 配桃橘 thumb，支援單手快速跳頁，顯示「5 / 12」頁碼；桌機版保留 thumbnail 條（768px 分水嶺 RWD）
- **播放器 100dvh viewport**：使用 dynamic viewport unit，在行動瀏覽器工具列自動隱藏時回收畫面空間；`touch-action: manipulation` 消除 iOS 300ms tap 延遲；`overscroll-behavior: none` 防止 pull-to-refresh 誤觸
- **iOS Safari 加入主畫面提示 banner**：第一次在 iPhone/iPad Safari 打開時顯示一次性底部提示，告知加入主畫面可全螢幕使用；使用者關閉後 localStorage 記住不再顯示

### Fixed
- **PWA 安裝修正**：v0.2.0.0 及更早版本的 `manifest.json` 用 `"start_url": "/"`，在 GitHub Pages project site（`/entexplainpage/`）下會把 standalone app 鎖到 user root（`lemonicefate.github.io/`），安裝後無法正確開啟。現改 `"./"` 並新增 `scope: "./"`
- **Service Worker scope 修正**：將 `sw.js` 從 `js/sw.js` 搬到 project root，讓 SW scope 涵蓋整個 app；`PRECACHE_URLS` 從絕對路徑 (`/index.html`) 改相對路徑 (`./index.html`)，修正 SW install 時 `cache.addAll` 抓到 404 而從未成功 activate 的 bug（過去的「離線支援」在 production 事實上沒運作）
- **更新 banner 誤判**：SW scope 修正後，`clients.claim()` 會在首次安裝時就設定 controller，導致 update banner 在全新安裝也誤顯示並擋住返回按鈕。改為在 `updatefound` 當下捕捉 controller 狀態，僅真正更新時才提示

### Changed
- SW cache 版本 `entexplain-v3` → `entexplain-v4`，強制重新抓取所有資產（避免混用舊絕對路徑 cache）

### Upgrade notes
- **升級後建議在 iPad Safari 清一次 site data** 確保完全乾淨：設定 → Safari → 進階 → 網站資料 → 搜尋 entexplainpage 移除。不清也可以，新 SW 會接管，舊 SW 殘留無副作用。
- 升級後請重新「加入主畫面」一次，以使用正確的 start_url

## [0.2.0.0] - 2026-04-24

### Added
- **首頁重新設計**：品牌列（衛 / 診間解說 / Explain）、⌘K 搜尋輸入、篩選 chip（全部 / ★ 釘選 / 解釋病情 / 手術流程 / 計算機）、卡片 TagPill + 釘選按鈕（localStorage 持久化）
- **播放器重新設計**：深色 `#0f2a42` 全螢幕、左上返回 / 右上專案標題＋頁面副標、中央條紋 frame 內含圖片或大字標題說明、底部上下頁 + 工具列（畫筆 / 聚光燈 / 雷射指標 / 退出）、縮圖列
- **播放器工具**：雷射指標（紅色發光點）、聚光燈（暗化 radial overlay）、畫筆（toggle 預留）
- **新增鍵盤快捷**：`L` 雷射、`S` 聚光燈、`P` 畫筆、`1`–`9` 跳頁、`Space` 下一頁
- **計算機頁**：BMI / 血脂風險 + Statin 健保給付 / 小兒劑量 三個 calculator，左輸入右結果（sticky），含規則逐條核對與摘要
- **路由擴充**：`#/calc` `#/calc/<id>` 計算機頁
- 資料 schema 擴充：`subtitle` / `type` / `region` / `slides`

### Changed
- **設計系統全面替換為 Warm Teal × Peach**：主色 `#0e7c7b`、深藍字 `#0f2a42`、桃橘 `#e5966a`、Noto Sans TC + Instrument Serif 字型組合
- DESIGN.md 完整改版以反映新設計系統與元件
- PWA `theme_color` 改為 `#0e7c7b`，App 名稱改為「診間解說 · Explain」
- SW cache 版本 `entexplain-v3`
- admin.html 顏色 token 同步更新

## [0.1.1.0] - 2026-04-14

### Added
- DESIGN.md：一站式設計系統文件，涵蓋色彩 token、字型、間距、圓角、陰影、元件規格、無障礙標準、資料格式、新增衛教項目 checklist

### Changed
- CSS custom property 全面重構：統一命名為語義化 token（`--bg-primary`、`--text-on-dark-subtle` 等共 40 個 token），所有 hardcoded 色值、字型大小、字重、圓角、轉場時間均改為 `var(--token)`

## [0.1.0.0] - 2026-03-31

### Added
- 診間衛教投影片系統：醫師可以在診間用視覺化流程向病人解釋手術和其他醫療項目
- 四大衛教分類：手術、耳鼻喉、減重、功能醫學，首頁 tab 快速切換
- 全螢幕投影片模式：左右滑動或箭頭翻頁，每步顯示解剖圖 + 説明文字
- PWA 離線支援：Service Worker 預快取核心資源，斷網也能使用
- 螢幕常亮：投影片模式自動啟用 Wake Lock，醫師講解時不會自動鎖屏
- 誤觸防護：50px 滑動閾值 + 雙指偵測，邊指圖邊講解不會意外翻頁
- 鍵盤導航：左右箭頭翻頁、Escape 返回、Tab 鍵 focus 管理
- 無障礙支援：ARIA 標籤、aria-live 步驟通知、高對比配色（WCAG AA）
- 響應式設計：桌機 3 欄 / 平板 2 欄 / 手機 1 欄，投影片自適應螢幕
- 説明完畢結束畫面
- SW 版本更新通知
- 離線狀態 banner
- 28 個單元測試 + E2E 測試規格
- 範例手術資料：闌尾切除術（5 步驟）、疝氣修補術（4 步驟）
