# Changelog

All notable changes to this project will be documented in this file.

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
