# TODOS

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

## Completed

### AbortController 用於圖片預載
**Priority:** Medium
**What:** 醫師點錯手術立即返回再點另一個時，前一個的預載請求應該被取消，不跟新的搶頻寬。
**Status:** 已排程 remote agent 於 2026-05-08 09:00 處理（trigger `trig_016HpfGshq8NjmNS9yv7ebLv`），將用 image array + `img.src = ''` 取消方式修正 `preloadAbort` dead code。

### Keyboard navigation + ARIA 無障礙支援
**Priority:** Medium
**Completed:** v0.2.0.0 (2026-04-24)
**What:** 鍵盤左右箭頭翻頁、`aria-live`、`role="region"`、返回按鈕 aria-label。
**Note:** v0.2.1.0 又新增 reader mode 的 `aria-live` 在 scrubber label 與 `aria-hidden` 於 tap zones，進一步完善無障礙。
