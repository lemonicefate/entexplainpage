# ADR-0002：衛教內容 canonical source 與交易式持久化

## 狀態

Accepted — 2026-07-31

## Context

`procedures/index.json` 原本同時承擔首頁策展與衛教 metadata，detail JSON 又各自保存一部分資料；這會讓分類、縮圖、步驟數與實際內容漂移。管理端也曾把 JSON 寫入與圖片上傳拆成兩個 HTTP 操作，任何中斷都可能留下首頁卡片、detail 與資產不一致的狀態。

## Decision

- `procedures/{id}.json` 是每篇衛教的 canonical source。它必須保存 `id`、`title`、`type`、`subtitle`、`region`、`category`、`categories`、`thumbnail` 與完整 `steps`。
- `procedures/index.json` 只保存分類字典、策展順序與由 canonical detail 投影出的 procedure entries。`slides` 永遠由 `steps.length` 投影，不是另一份可編輯的來源。
- `read(id)` 回傳 canonical metadata、opaque revision 與 opaque asset handles；`commit({ operation, ... })` 是 create、revision-safe replace、delete 的唯一 mutation seam；`inspect()` 是唯讀 integrity seam。HTTP 與 admin 只負責 adapter translation。
- revision 是目前 detail、其 index projection 與所引用 asset bytes 的 opaque SHA-256 digest。它不寫回 detail，因此人工 JSON 編輯會在下一次 replace/delete 時自然形成 conflict。
- 每個 commit 先把 complete after state 寫入 transaction staging，再以 journal 記錄 `staging`、`trashing`、`promoting`、`committed`、`cleanup` phase。commit point 是 durable `committed` marker：marker 前啟動恢復 before，marker 後完成 after 並重試 cleanup。
- managed reads 與 commits 使用同一個 process-wide serialized Module Interface；server 必須在 listen 前完成 journal recovery。直接由外部工具讀工作樹，不在這項原子性保證內。
- rollback 失敗會建立 `recovery-required` marker，拒絕新的 managed commit，直到人工/啟動 recovery 成功。cleanup trash 失敗不反轉已成功 commit，會回傳 warning 並讓 inspect/recovery 收斂 orphan transaction artifacts。

## Guarantees and limits

完整性 gate 會阻擋 detail/index 一對一破壞、重複 ID、metadata projection 漂移、非法分類、缺失/跨內容資產與步驟數錯誤。既有空白 alt 是 warning；新 create/replace 則要求非空 alt。這個 repository 是 GitHub Pages 靜態輸出，受管理 atomicity 只涵蓋本機 persistence Module 與 server adapter，不涵蓋使用者繞過 server 直接讀寫工作樹的瞬間狀態。
