# ADR-0003：衛教圖卡 canonical schema（JSON Schema）

## 狀態

Accepted — 2026-11-05

## Context

ADR-0002 定了 canonical source 與 projection 的責任邊界，但欄位層級的規格只存在於 integrity script 與慣例裡，沒有一份機器可檢查的正式規格。2026-11-05 白話 grill 逐項定案後，把規格寫成 `procedures/schema.json`（JSON Schema draft 2020-12）。

## Decision

- `procedures/schema.json` 是 detail 檔的正式規格；新圖卡不合規就擋下來。
- `type` 允許 `explain`、`surgery`、`flowchart`。`surgery` 是既有類型（程式與測試本來就允許），予以保留；`flowchart` 是本次新增，給頭暈鑑別診斷流程圖升級預留。`flowchart` 目前尚無專屬 renderer，上站前需依 TODOS 完成。
- `region` 欄位刪除。17 篇 detail 與 index 投影皆已移除；app.js fallback 副標改用 `type`，搜尋不再含 `region`，admin 表單與 admin.js、migrate-canonical.js 的接線一併拆除。
- `category`／`categories` 保留多分類。`category` 必須是 `categories` 的第一項（主分類），這是既有規則：index 投影與首頁標籤皆以第一項為準，gate 的 `primary-category-mismatch` 與 schema 的 `prefixItems` 各檢查一次。
- `alt` 改為選填。既有值保留無害；與 `description` 相同內容時可省略。integrity gate 的 `legacy-empty-alt` warning 與 persistence Module 的 `missing-step-alt` 檢查一併移除。
- `subtitle`、`description` 允許空字串。內容在圖裡的新圖卡（自律神經檢測、失眠 CBT-I）即如此，現況 12/17 篇副標為空、55/69 處步驟說明為空。
- `slides` 仍不寫在 detail，由 `steps.length` 投影（ADR-0002 不變）。

## Guarantees and limits

- schema 與 integrity gate 檢查同一套規則：schema 擋欄位形狀與枚舉，gate 另擋 projection 漂移、資產與步驟數。兩邊的 `type` 枚舉與 `category` 第一項規則必須同步改。
- `procedures/schema.json` 目前是文件與人工驗證用，integrity gate 尚未直接載入它做驗證；未來要接上時，以 schema 為準、gate 規則隨之收斂。
- 本次遷移同時把 PR #59 的兩篇 detail（自律神經檢測、失眠 CBT-I）從單行 compact JSON 正規化為 2 空格 pretty 格式，與其餘 15 篇及 `writeJsonAtomic` 的輸出一致；內容不變。
