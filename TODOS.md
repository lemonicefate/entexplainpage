# TODOS

## TODO: AbortController 用於圖片預載
**Priority:** Medium
**What:** 醫師點錯手術立即返回再點另一個時，前一個的預載請求應該被取消，不跟新的搶頻寬。用 AbortController 管理 fetch/image preload 請求。
**Why:** 避免診間網路較慢時，舊的預載影響新手術的載入速��。
**Context:** app.js 中進入投影片模式時會預載所有步驟圖片。如果醫師快速切換手術，多組預載會同時執行。在 Wi-Fi 不穩的診間，這會導致新手術的圖片載入延遲。
**Depends on:** 核心投影片渲染功能完成後。

## TODO: Keyboard navigation + ARIA 無障礙支援
**Priority:** Medium
**What:** 加入鍵盤左右箭頭翻頁、focus management、aria-live 區域、role 屬性。
**Why:** 台灣醫療機構有無障礙法規要求。部分醫師用桌機 + 鍵盤操作，鍵盤翻頁比用滑鼠點箭頭更快。
**Context:** 目前設計只有 touch gesture + 箭頭按鈕。需要加入：keydown event listener（左右箭頭）、aria-live="polite" 在步驟變更時通知 screen reader、focus trap 在投影片模式中、role="region" 標記投影片區域。注意：/plan-design-review 已在設計文件中加入了詳細的 ARIA 規格，實作時參考設計文件。
**Depends on:** 核心投影片渲染功能完成後。

## TODO: Calculator 測試策略 — 按「出錯會不會害到病人」分層
**Priority:** High
**What:** 每個計算機要有自己的測試檔（不是一個大檔），但只對「權威抄寫型」規則寫 golden-file 測試。

**測試分層決策表：**

| 情境 | 要測嗎 | 理由 |
|---|---|---|
| 演算法抄自權威來源（國健署 BMI 分級、健保 Statin 給付條文、藥典 mg/kg 標準） | **一定要** | 測試就是「抄對了嗎」的 golden-file。規範更新時，測試會逼你同步 |
| 演算法是自創或估算（例：現行 Lipid 那個 `rf*3.2+...` 湊出來的 ASCVD） | **不要** | 鎖死湊出來的公式 = 把 bug 變成規格 |
| 純 UI / layout calc（只做輸入顯示、無臨床計算） | **不要** | e2e smoke 就夠 |

**檔案結構（每個 calc 獨立檔）：**
```
tests/unit/
├── app.test.js              （結構/SW/manifest — 共用）
└── calc/
    ├── bmi.test.js          （國健署 BMI 分級邊界：18.5 / 24 / 27 / 30 / 35）
    ├── lipid.test.js        （健保 Statin 給付規則矩陣 — 等換掉現行湊公式後才寫）
    ├── peds-abx.test.js     （小兒抗生素 mg/kg 對照表 edge cases）
    └── ...
```
每檔 10–20 測試獨立、不互相污染，`npm test` 一指令跑全部。

**真正該問的問題：** 不是「要不要測」，是「**哪幾條規則一旦錯了病人會出事**」。那幾條就是 P0 必測。

**Why:** 醫療 app 的測試重點不是 coverage %，是 safety-critical 路徑鎖死。抄自 guideline 的規則錯了，病人吃錯藥或被錯誤分級；湊出來的公式本來就不該被當成 ground truth。

**Context:** 現行 v0.2.0.0 的 BMI/Lipid/Peds 是 demo placeholder，Lipid 的 ASCVD 公式是湊的，先不寫測試。等真實 calc 上線時，**每個 calc 的 PR 自帶 tests/unit/calc/{id}.test.js**，用這個分層表判斷哪些 rule 要鎖死。
**Depends on:** 每個真實 calculator 上線時同 PR 處理。

