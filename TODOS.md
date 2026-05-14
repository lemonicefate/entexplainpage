# TODOS

entexplainpage 的**唯一待辦追蹤檔**。已發布的事看 `CHANGELOG.md`,領域語彙看 `CONTEXT.md`,決策看 `docs/adr/`,專案慣例與已知限制看 `CLAUDE.md`。

每筆 `## TODO:` 自帶 Priority / What / Why / Context / Depends-on,讓 AI agent 能直接 pick up 執行。依 Priority 由高到低排列。

---

## TODO: CI/CD — GitHub Actions
**Priority:** High
**What:** push / PR 自動跑 Vitest + Playwright,main 綠燈才允許 squash merge。
**Why:** 目前無 CI,commit 前測試靠人工 `npm test && npm run test:e2e`,容易漏跑或忘跑。
**Context:** 需要 `.github/workflows/`。注意 dual `node_modules.win` / `node_modules.linux` 模式 — CI 在 ubuntu 上跑,要確保用 linux 版或乾淨 `npm install`。
**Depends on:** 無。

## TODO: Calculator 測試策略 — 按「出錯會不會害到病人」分層
**Priority:** High
**What:** 每個計算機要有自己的測試檔（不是一個大檔），但只對「權威抄寫型」規則寫 golden-file 測試。

**測試分層決策表：**

| 情境 | 要測嗎 | 理由 |
|---|---|---|
| 演算法抄自權威來源（國健署 BMI 分級、健保 Statin 給付條文、藥典 mg/kg 標準） | **一定要** | 測試就是「抄對了嗎」的 golden-file。規範更新時，測試會逼你同步 |
| 演算法是自創或估算（例：早期 Lipid 那個 `rf*3.2+...` 湊出來的 ASCVD，已於 v0.2.3.2 後移除） | **不要** | 鎖死湊出來的公式 = 把 bug 變成規格 |
| 純 UI / layout calc（只做輸入顯示、無臨床計算） | **不要** | e2e smoke 就夠 |

**檔案結構（每個 calc 獨立檔）：**
```
tests/unit/
├── app.test.js              （結構/SW/manifest — 共用）
└── calc/
    ├── bmi.test.js          （國健署 BMI 分級邊界：18.5 / 24 / 27 / 30 / 35 — 待補）
    ├── lipid.test.js        （✅ 已落地：健保 031170 Statin / Fibrate 給付規則矩陣，39 測試）
    ├── peds-abx.test.js     （小兒抗生素 mg/kg 對照表 edge cases — 待補）
    └── ...
```
每檔 10–20 測試獨立、不互相污染，`npm test` 一指令跑全部。

**逐 calc 狀態：**
- BMI：國健署分級邊界 golden-file — 待補（現為 demo placeholder）
- Lipid：✅ 已落地 `tests/unit/calc/lipid.test.js`（健保 031170 給付規則矩陣，39 測試）
- Peds-dose：藥典 mg/kg 對照表 edge cases — 待補（現為 demo placeholder）
- Mounjaro：濃度表 + 三欄連動數學已有 9 個 golden 測試，暫放 `tests/unit/app.test.js` 的 `Mounjaro calculator math` describe，待測試分層落地時搬到獨立檔 `tests/unit/calc/mounjaro.test.js`

**真正該問的問題：** 不是「要不要測」，是「**哪幾條規則一旦錯了病人會出事**」。那幾條就是 P0 必測。

**Why:** 醫療 app 的測試重點不是 coverage %，是 safety-critical 路徑鎖死。抄自 guideline 的規則錯了，病人吃錯藥或被錯誤分級；湊出來的公式本來就不該被當成 ground truth。

**Context:** 早期 v0.2.0.0 的 BMI/Lipid/Peds 是 demo placeholder。Lipid 已於 2026-05-14 改寫為健保 031170 給付查表並同 PR 自帶 `tests/unit/calc/lipid.test.js`（39 測試）。剩 BMI、peds-dose 仍是 placeholder。
**Depends on:** BMI / peds-dose 各自真實上線時同 PR 處理。

## TODO: admin.html 在 GitHub Pages 純靜態環境的 UX 邊界
**Priority:** Medium
**What:** 持續修補 admin.html 在純靜態主機上的 UX 邊界情況。
**Why:** admin.html 線上版無寫入能力（GitHub Pages 跑不了 `scripts/admin.js` 的 `/api/*`），UI 容易看起來像壞掉。
**Context:** v0.2.3.2 已加 hostname 偵測（非 localhost 顯示 local-only 說明卡）、main site link 修正。後續若再發現破圖 / 誤導訊息再補。
**Depends on:** 無（被動修補，發現一個修一個）。

## TODO: procedures/index.json 資料完整性巡檢
**Priority:** Low
**What:** 定期巡檢 `procedures/index.json` 與各 `procedures/{id}.json` 的欄位完整性（type / category / steps 等）。
**Why:** 新增衛教 / backfill 時容易漏欄位，首頁篩選 chip 會出錯。
**Context:** v0.2.3.2 之後已補完 snore 條目缺漏欄位。
**Depends on:** 無。

## TODO: 新計算機 — eGFR（CKD-EPI 2021）
**Priority:** Low
**What:** 第 5 支內建計算機,腎功能估算,用 CKD-EPI 2021 公式。
**Why:** README「新增計算機」範例中提到的下一支候選。
**Context:** 屬「依據明確指引」型,需配 golden-file 測試（見 Calculator 測試策略 TODO）。寫在 `js/app.js` 的 `renderEgfr()`,加進 `CALCULATORS`（含 `tabLabel` 欄位）。
**Depends on:** 無。

## TODO: Mounjaro 對應的衛教 procedure JSON
**Priority:** Low
**What:** 做一篇圖卡解說「分抽 / 殘劑使用注意事項」的 procedure。
**Why:** 目前 Mounjaro 只有計算機,沒有衛教圖卡;分抽 / 殘劑是 off-label,病人端需要清楚的注意事項說明。
**Context:** `type: "explain"`,放 `procedures/`。內容對齊 sterility 風險（單支 pen 限同一病人、重複穿刺風險）。
**Depends on:** 無。

## TODO: 衛教 / 手術項目持續擴充
**Priority:** Low
**What:** 持續新增衛教與手術流程內容。
**Why:** 內容是這個工具的核心價值。
**Context:** 目前 13 篇 explain（snore、nasal-obstruction、vocal-cord、influenza、quit-smoke、oral-ulcer、menieres、tinnitus、ssnhl、otitis-media-effusion、vitd、atopic-dermatitis、testosterone）；**尚無 surgery 類型實體資料**。
**Depends on:** 無。

## TODO: preloadAbort AbortController 驗證收尾
**Priority:** Low
**What:** 確認 `state.preloadAbort`（`js/app.js:19 / 761 / 765`）的 AbortController 真的有正確取消前一個手術的圖片預載,不是部分接上的死碼。
**Why:** 醫師點錯手術立即返回再點另一個時,前一個的預載請求應該被取消,不跟新的搶頻寬。曾排程遠程 agent 於 2026-05-08 處理,程式碼現在看起來已接上 `new AbortController()` + `.abort()`,但需實測驗證再關掉。
**Context:** 原本是 `preloadAbort` dead code。驗證方式：快速切換手術,確認 network 面板舊請求被 cancel。
**Depends on:** 無。

## TODO: /calc 標籤列策展機制（等計算機多再做）
**Priority:** Low
**What:** 當內建計算機超過 ~10 支、`.calc-tabs` 換行後變成 2–3 列佔用過多頂部空間時，為標籤列加策展機制（釘選 / 常用集合），bar 只顯示少數，長尾交給首頁 grid。
**Why:** `.calc-tabs` 的定位是「快速切換器」，不是計算機索引 — 索引已經是首頁 grid（搜尋 +「計算機」篩選 chip + 釘選）。計算機還少時，扁平列出全部 + `flex-wrap` 降級就夠；現在就蓋策展系統是為假想需求設計。
**Context:** 2026-05-14 的 grill 決定：先做 `flex-wrap` 降級 + 合併 `CALCULATORS` / `calcDefs` 兩份註冊表，策展延後。策展可沿用既有 `state.pins`。觸發條件到了再回來。
**Depends on:** 內建計算機數量增長到 ~10 支。

## TODO: Scrubber rAF throttle（等 steps 多再做）
**Priority:** Low
**What:** 若未來任一手術超過 ~20 steps，把 `setupScrubber()` 的 `input` handler 包 `requestAnimationFrame` throttle，避免拖拉時觸發過多 `renderStep` 影響幀率。
**Why:** Reviewer 在 v0.2.1.0 PR 提出此擔憂。當下每支手術 4–5 steps，拖整條 scrubber 最多 5 次 input event，不是效能問題；現在加 throttle/debounce 只會引入拖動延遲反而傷 UX。
**Context:** 正確手段是 `rAF` throttle（保持 60fps 上限），不是 debounce（會 lag）。觸發條件：`max(proc.steps.length) > 20`。
**Depends on:** 真實頁數增長到 20+。
