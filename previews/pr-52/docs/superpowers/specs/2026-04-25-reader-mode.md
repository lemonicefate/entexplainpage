# Reader Mode + PWA Path Fix (v0.2.1.0)

**Date:** 2026-04-25
**Branch:** `feat/reader-mode-v0.2.1.0`
**Target version:** 0.2.0.0 → **0.2.1.0** (MINOR — new UX feature + embedded PWA fix)
**Trigger:** 診間 iPad Safari dogfood 發現 (1) 安裝到主畫面時 URL 鎖在 root、(2) 瀏覽器 chrome 佔畫面太多、(3) 頁面導覽摩擦大

---

## Part A — PWA Path Fix (必做，獨立 bug)

### Root cause

GitHub Pages project site 部署在 `https://lemonicefate.github.io/entexplainpage/`，但以下檔案用了絕對路徑 `/`（指向 user root，非 project root）：

| 檔案 | 問題 | 修正 |
|---|---|---|
| `manifest.json:5` | `"start_url": "/"` → 安裝後跳到 `lemonicefate.github.io/` 顯示 404 或別人的 page | `"start_url": "./"` |
| `manifest.json` | 無 `scope` 欄位 → Safari 預設 manifest 所在目錄，可能也被解成 `/` | `"scope": "./"` |
| `js/sw.js:3-10` | `PRECACHE_URLS` 全部 `/xxx` → SW install 時 `cache.addAll` fetch `/index.html` = 404 → install 失敗 → **SW 在 production 從未 activate** | 全改 relative (`./index.html` etc.) |
| `js/sw.js` 位置 | 放在 `js/sw.js` → SW scope 預設 = `js/`，只能控制 `/entexplainpage/js/*`，無法攔截全站 fetch | 移到 root `/sw.js` |
| `js/app.js:587` | `navigator.serviceWorker.register('js/sw.js')` | 改 `register('./sw.js')` |

### 驗證方法

部署後從 iPad Safari：
1. 打開 `https://lemonicefate.github.io/entexplainpage/` → 分享 → 加入主畫面
2. 從主畫面 icon 打開 → 應進入 standalone 模式（無 Safari chrome），網址顯示 `/entexplainpage/`
3. DevTools (Mac Safari 遠端) → Application → Service Workers → 應看到 active SW，scope = `/entexplainpage/`
4. 離線模式 → 重新整理 → app 仍可運作

### 風險

- 既有 v2/v3 cache 使用者：新 SW 在新 scope 下註冊，舊 SW（錯 scope）會殘留但無影響。用戶可能要手動清 Safari site data 才會乾淨。在 CHANGELOG 註明。
- 搬動 `js/sw.js` → `sw.js` 會改變 git history；兩個 commit 分開寫（1: move file、2: fix paths）方便 bisect。

---

## Part B — Reader Mode (feature)

### 目標互動（參照 Kindle/iBooks/comiXology e-book pattern）

```
┌─────────┬──────────┬─────────┐
│         │          │         │
│  PREV   │  TOGGLE  │  NEXT   │
│  33%    │   34%    │  33%    │
│         │          │         │
│         │          │         │
└─────────┴──────────┴─────────┘
         ↑
       scrubber (bottom)
```

- **左側 tap** → 上一頁
- **右側 tap** → 下一頁
- **中央 tap** → toggle 頂部返回列 + 底部工具列 + scrubber 顯示/隱藏
- **進入播放** → chrome 顯示 3 秒自動隱藏（新手友善）
- **底部 scrubber** → `<input type="range">` 拖拉快速跳頁，顯示「5 / 12」
- **手機版**：scrubber 取代 thumb strip；**桌機版**：保留 thumb strip（RWD `@media (min-width: 768px)`）

### 與現有功能共存規則

| 現有功能 | Reader mode 行為 |
|---|---|
| Swipe gesture (dx ≥ 50) | 保留，不受影響（tap 事件在 swipe 時瀏覽器自動 suppress） |
| Keyboard shortcut (1-9/L/S/P/Space/←→/Esc) | 完全保留，不影響 |
| Tool active（pen/spot/laser） | **tap zones 停用**（`pointer-events: none`），chrome 強制顯示，避免誤觸干擾繪圖 |
| Thumb strip (桌機) | 保留、與 scrubber 同步雙向綁定 |
| Wake lock | 保留，進出 reader mode 不影響 |

### 元件清單

**HTML（`#slide-view` 內新增）：**
```html
<div id="tap-zones" aria-hidden="true">
  <button class="zone zone-prev" aria-label="上一頁"></button>
  <button class="zone zone-toggle" aria-label="顯示工具列"></button>
  <button class="zone zone-next" aria-label="下一頁"></button>
</div>
<div id="scrubber-wrap" class="player-scrubber">
  <input id="scrubber" type="range" min="0" max="0" value="0" step="1" aria-label="跳至頁面">
  <div id="scrubber-label" aria-live="polite">1 / 1</div>
</div>
```

**CSS（新增 ~80 行）：**
- `:root` 新增 token：`--chrome-hide-duration: 240ms`
- `.player` 改用 `height: 100dvh`（動態視口）+ `overscroll-behavior: none`、`touch-action: manipulation`
- `#tap-zones` absolute 覆蓋 stage，三欄 flex 33/34/33
- `.player.is-immersive` class → 頂部/底部工具列 `transform: translateY(±100%)` + `opacity: 0`
- `@media (max-width: 767px)` → `#thumb-strip { display: none }`
- `@media (min-width: 768px)` → `#scrubber-wrap { display: none }`

**JS（新增 ~100 行在 `js/app.js`）：**
- `state.chromeHidden: false`
- `state.chromeTimer: null`
- `scheduleChromeHide()` — 3s 後 hide；每次 tap 重置
- `showChrome()` / `hideChrome()` — toggle CSS class
- `setupTapZones()` — 3 個 zone 綁 click；tool active 時 `return`
- `setupScrubber()` — `input` event → `jumpTo(Number(e.target.value))`；`renderStep()` 內反向同步 `scrubber.value = stepIndex`
- `enterPlayer()` 末尾呼叫 `scheduleChromeHide()`
- `exitToHome()` 清除 timer + 重置 `chromeHidden`

### iOS Safari 安裝提示 banner（one-time）

**觸發條件（全部符合）：**
- UA 偵測為 iPhone / iPad Safari（非已安裝 PWA）
- `window.matchMedia('(display-mode: standalone)').matches === false`
- `localStorage.getItem('dismissed_install_hint') !== '1'`

**UI：**
```
┌──────────────────────────────────────────┐
│ 📱 加入主畫面可全螢幕使用        ✕       │
│ 分享 → 加入主畫面                        │
└──────────────────────────────────────────┘
```

位置：底部 fixed banner，slide-in from bottom。叉叉關閉 → 寫 localStorage，不再顯示。

---

## Commits 規劃（bisectable，squash 前保持乾淨）

| # | Commit | 檔案 | 行數估計 |
|---|---|---|---|
| 1 | `fix(pwa): move sw.js to root for proper scope` | `git mv js/sw.js sw.js` + 更新 `js/app.js:587` register path + 更新 `tests/unit/app.test.js` 讀取路徑 | ~10 |
| 2 | `fix(pwa): use relative paths so project-site install works` | `manifest.json` start_url/scope、`sw.js` PRECACHE_URLS、`tests/unit/app.test.js` asserts | ~15 |
| 3 | `feat(reader): tap-zone navigation (prev/toggle/next)` | `index.html` 新增 zones、`js/app.js` setupTapZones()、CSS positioning | ~60 |
| 4 | `feat(reader): auto-hide chrome + 100dvh viewport` | state/timer 邏輯、`.is-immersive` class、`100dvh`、`touch-action` | ~50 |
| 5 | `feat(reader): bottom scrubber replaces thumbs on mobile` | `<input type=range>`、sync 邏輯、RWD media queries | ~50 |
| 6 | `feat(pwa): iOS Safari add-to-home-screen hint banner` | UA 偵測、banner HTML/CSS、localStorage dismiss | ~50 |
| 7 | `test: reader mode + pwa paths` | unit (tap zones DOM、scrubber、manifest paths、SW location)、e2e (tap-to-navigate、scrubber drag) | ~80 |
| 8 | `chore: bump to v0.2.1.0 + CHANGELOG + DESIGN.md` | CHANGELOG、VERSION、DESIGN.md reader mode 章節、TODOS.md 清理已完成項 | ~40 |

總計：**~355 行新增**（含測試）

---

## Test plan

**Unit（vitest，目標 32+ tests）：**
- SW 在 root `/sw.js`
- PRECACHE_URLS 全 relative
- manifest `start_url: "./"`、`scope: "./"`
- `#tap-zones` 存在、三個 button with aria-label
- `#scrubber-wrap` 存在、range input min/max 正確屬性
- `.is-immersive` class 套用後 DOM 結構不變

**E2E（playwright，目標 8+ tests）：**
- iPad Safari viewport (768×1024) 進入播放器
- 左側 tap → 頁碼遞減 / 右側 tap → 頁碼遞增
- 中央 tap → toggle chrome class
- 工具啟用（按 L）時左右 tap 不翻頁
- 拖拉 scrubber → stepIndex 同步
- 3 秒後 chrome 自動隱藏（用 `waitFor` + timeout）
- 桌機 viewport (1440×900) → thumbs 顯示、scrubber 隱藏
- 手機 viewport (375×667) → scrubber 顯示、thumbs 隱藏

**手動驗證（你在診間 iPad）：**
- [ ] 加入主畫面 → 從 icon 開啟 → 進入 standalone、無 Safari chrome
- [ ] 離線飛航模式 → 已開過的頁面仍可使用
- [ ] 讀模式三區 tap、中央 toggle、scrubber drag 流暢
- [ ] 工具啟用時 tap zones 不誤觸
- [ ] iOS Safari 第一次開啟 → banner 顯示；叉叉關 → 不再出現

---

## TODOS.md 清理（順便）

完成此 PR 後應移入 `## Completed`：
- `TODO: Keyboard navigation + ARIA 無障礙支援` — v0.2.0.0 已實作
- `TODO: AbortController 用於圖片預載` — 有排程 agent 處理（trig_016HpfGshq8NjmNS9yv7ebLv）

保留：
- `TODO: Calculator 測試策略` — 等真實 calc 上線才用到

---

## Risk & Scope Lock

**不做的事（避免 scope creep）：**
- 不改設計系統 token
- 不動現有 keyboard shortcut
- 不動 calculator 畫面
- 不動 procedure schema
- iOS install banner 不做 A2HS prompt（iOS 不支援 JS 觸發）— 純文字提示

**已知風險：**
- `100dvh` 在舊 iOS <15.4 不支援 → fallback `100vh`（已有 CSS fallback 寫法）
- `touch-action: manipulation` 在 Android Chrome OK，iOS Safari OK — 無需 fallback
- SW scope 變更：舊安裝者升級後會註冊新 scope SW，舊的殘留無害但存在 → CHANGELOG 建議一次性清除 site data（或等 cache TTL 到期）
