# entexplainpage Roadmap

**Status**: 🟡 Maintenance
**Last updated**: 2026-05-14 (血脂計算機改寫為健保給付查表)
**Current version**: v0.2.3.2 (GitHub Pages 上線中；之後累積 content / chore 與 Mounjaro 計算機，未發新版)

## 🔧 Active maintenance
- [ ] 持續修補 admin.html 在 GitHub Pages 純靜態環境下的 UX 邊界（v0.2.3.2 已加 hostname 偵測、main site link 修正）
- [ ] `procedures/index.json` 資料完整性巡檢（v0.2.3.2 之後已補完 snore 條目缺漏欄位）
- [ ] iPad Safari 加到主畫面後的 PWA 行為回歸測試（每次 SW cache bump 後）

## 📅 Up next
- [ ] CI/CD（GitHub Actions：push / PR 自動跑 Vitest + Playwright，main 綠燈才允許 squash merge）
- [ ] 計算機測試分層落地（依 TODOS.md 決策表，每個真實 calc 上線時同 PR 自帶 `tests/unit/calc/{id}.test.js`）
  - BMI：國健署分級邊界（18.5 / 24 / 27 / 30 / 35）golden-file
  - Lipid：✅ 已落地 `tests/unit/calc/lipid.test.js`（健保 031170 給付規則矩陣，39 測試）
  - Peds-dose：藥典 mg/kg 對照表 edge cases
  - Mounjaro：濃度表 + 三欄連動數學已有 9 個 golden 測試（暫放 `tests/unit/app.test.js` 內 `Mounjaro calculator math` describe，待測試分層落地時搬到獨立檔）

## 🗂️ Backlog
- 超過 20 步驟手術的 scrubber `requestAnimationFrame` 節流（觸發條件：`max(proc.steps.length) > 20`，現在每支手術 4–5 步驟還不需要）
- 圖片預載 AbortController 修正 `preloadAbort` dead code（已排程遠程 agent 於 2026-05-08 09:00 處理，trigger `trig_016HpfGshq8NjmNS9yv7ebLv`）
- 新計算機：eGFR（CKD-EPI 2021）— README 範例中提到的下一支候選
- Mounjaro 對應的衛教 procedure JSON（目前只有計算機，沒有圖卡解說「分抽 / 殘劑使用注意事項」）
- 衛教 / 手術項目持續擴充（目前 13 篇 explain：snore、nasal-obstruction、vocal-cord、influenza、quit-smoke、oral-ulcer、menieres、tinnitus、ssnhl、otitis-media-effusion、vitd、atopic-dermatitis、testosterone；尚無 surgery 類型實體資料）

## ✅ Recently done
- [x] **血脂計算機改寫為健保給付查表**（2026-05-14）— `#/calc/lipid` 移除無依據的 `rf*3.2+...` ASCVD 假公式、CKD 與年齡/性別欄;依健保署降血脂藥物給付規定（文件 031170）改寫為 Statin + Fibrate 雙判定（病人類別 → 起始閾值 / 目標值 / 非藥物治療）。糖尿病改列最高類別、新增 Fibrate 給付與併用藥警示。純函式 `lipidCoverage()` 抽出 + `tests/unit/calc/lipid.test.js` 39 測試;`docs/adr/0001` + `CONTEXT.md` 記錄決策與語彙
- [x] **Mounjaro pen picker 橫排修正**（2026-05-12）— 6 顆 dose 按鈕被擠進 `.field` 140px 第二欄而變直排;新增 `.field-wide` (auto 1fr) 變體讓 seg 取得剩餘空間,桌機 6 顆一字排開、手機 ≤768px 一行 2 顆換行
- [x] **Mounjaro 針劑分抽 / 殘劑換算計算機**（2026-05-12）— 第 4 支 calc，`#/calc/mounjaro`。Pen 規格 picker（2.5/5/7.5/10/12.5/15 mg）+ 3 欄連動（mg / ml / 旋鈕喀噠），lastEdited 作為 pen 切換錨點。包含 off-label 安全提示 + 每支 pen 殘量參考。9 個單元測試在 `tests/unit/app.test.js` 的 `Mounjaro calculator math`
- [x] 內容批次擴充（v0.2.3.2 之後）— 新增 9 篇衛教：quit-smoke / oral-ulcer / menieres / tinnitus / ssnhl / otitis-media-effusion / vitd / atopic-dermatitis / testosterone
- [x] admin 表單補 `type` 欄位（explain / surgery）— 之前只有 category，無法分類首頁解釋病情 / 手術流程 chip；同步 backfill snore / nasal-obstruction / vocal-cord / influenza
- [x] `.gitattributes` 強制 LF 行尾 — WSL ↔ Windows 編輯器會 silently rewrite CRLF，污染 diff
- [x] v0.2.3.2 — admin.html 在 GitHub Pages 顯示 local-only 說明卡，避免破圖
- [x] v0.2.3.1 — 解說圖片大幅放大（拿掉 4:3 / 寬度上限）、Immersive 模式真正釋放版位
- [x] v0.2.3.0 — admin 編輯 / 刪除衛教、步驟拖拉排序、編輯模式圖片預覽
- [x] v0.2.2.0 — 畫筆真的會畫（canvas + Pointer Events）、聚光燈 / 雷射在 iPad 失效修正
- [x] v0.2.1.0 — Reader mode（tap zones + scrubber + auto-hide）、PWA scope / start_url 修正

## ⚠️ Known concerns
- 無 GitHub Actions CI（commit 前測試靠人工 `npm test && npm run test:e2e`）
- 計算機測試覆蓋分層不足（Lipid 已落地 golden-file；BMI / Peds-dose 仍待補）
- admin.html 線上版無寫入能力（純靜態 GitHub Pages 限制，編輯只能在 localhost）
- Service Worker 只在 production 生效，本機快取行為與線上不一致需注意
