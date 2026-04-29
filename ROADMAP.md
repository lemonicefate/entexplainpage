# entexplainpage Roadmap

**Status**: 🟡 Maintenance
**Last updated**: 2026-04-30
**Current version**: v0.2.3.2 (GitHub Pages 上線中；之後僅 content / chore 累積，未發新版)

## 🔧 Active maintenance
- [ ] 持續修補 admin.html 在 GitHub Pages 純靜態環境下的 UX 邊界（v0.2.3.2 已加 hostname 偵測、main site link 修正）
- [ ] `procedures/index.json` 資料完整性巡檢（v0.2.3.2 之後已補完 snore 條目缺漏欄位）
- [ ] iPad Safari 加到主畫面後的 PWA 行為回歸測試（每次 SW cache bump 後）

## 📅 Up next
- [ ] CI/CD（GitHub Actions：push / PR 自動跑 Vitest + Playwright，main 綠燈才允許 squash merge）
- [ ] 計算機測試分層落地（依 TODOS.md 決策表，每個真實 calc 上線時同 PR 自帶 `tests/unit/calc/{id}.test.js`）
  - BMI：國健署分級邊界（18.5 / 24 / 27 / 30 / 35）golden-file
  - Lipid / Statin：健保給付規則矩陣（等換掉現行湊出來的 ASCVD 公式後才寫）
  - Peds-dose：藥典 mg/kg 對照表 edge cases
- [ ] 替換 Lipid 計算機現行湊出來的 `rf*3.2+...` ASCVD 估算為有依據的演算法（或明確標示「僅供參考」）

## 🗂️ Backlog
- 超過 20 步驟手術的 scrubber `requestAnimationFrame` 節流（觸發條件：`max(proc.steps.length) > 20`，現在每支手術 4–5 步驟還不需要）
- 圖片預載 AbortController 修正 `preloadAbort` dead code（已排程遠程 agent 於 2026-05-08 09:00 處理，trigger `trig_016HpfGshq8NjmNS9yv7ebLv`）
- 新計算機：eGFR（CKD-EPI 2021）— README 範例中提到的下一支候選
- 衛教 / 手術項目持續擴充（目前 13 篇 explain：snore、nasal-obstruction、vocal-cord、influenza、quit-smoke、oral-ulcer、menieres、tinnitus、ssnhl、otitis-media-effusion、vitd、atopic-dermatitis、testosterone；尚無 surgery 類型實體資料）

## ✅ Recently done
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
- 計算機測試覆蓋分層不足（現行 Lipid ASCVD 公式是湊的，刻意不寫測試以免把 bug 變規格）
- admin.html 線上版無寫入能力（純靜態 GitHub Pages 限制，編輯只能在 localhost）
- Service Worker 只在 production 生效，本機快取行為與線上不一致需注意
