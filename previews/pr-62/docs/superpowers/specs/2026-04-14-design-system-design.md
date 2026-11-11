# DESIGN.md — 衛教投影片系統設計規格

> 一站式設計系統文件，涵蓋視覺 token、元件規格、無障礙標準、資料格式。
> 目標讀者：自己（未來回顧用）+ 其他可能貢獻 UI 的開發者/設計師。

---

## 1. 色彩系統

所有顏色以 CSS custom property 定義於 `:root`，禁止 hardcode hex。

### 基底色

| Token | 值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#FFFFFF` | 頁面背景、卡片背景 |
| `--bg-dark` | `#1A1A1A` | 投影片背景、結束畫面 |
| `--bg-muted` | `#F5F5F5` | 離線 banner、hover 底色 |
| `--bg-skeleton` | `#F0F0F0` | Skeleton 載入底色 |

### 文字色

| Token | 值 | 用途 |
|-------|------|------|
| `--text-primary` | `#1A1A1A` | 主要文字 |
| `--text-light` | `#FFFFFF` | 深色背景上的文字 |
| `--text-secondary` | `#666666` | 次要文字（grid header） |
| `--text-muted` | `#888888` | 非活躍 tab、輔助文字 |
| `--text-disabled` | `#999999` | 空狀態文字、banner 文字 |
| `--text-hint` | `#BBBBBB` | 空狀態副文字 |

### 互動色

| Token | 值 | 用途 |
|-------|------|------|
| `--accent` | `#0077B6` | 按鈕、活躍 tab、focus ring、PWA theme color |
| `--accent-hover` | `#005A8C` | hover 狀態 |

### 覆蓋層與邊框

| Token | 值 | 用途 |
|-------|------|------|
| `--border-light` | `#E0E0E0` | skeleton 中色調、離線 banner 邊框、圖片錯誤 fallback |
| `--overlay` | `rgba(0,0,0,0.7)` | 投影片文字面板 |
| `--overlay-nav` | `rgba(0,0,0,0.8)` | 投影片導航列 |

### 深色背景文字

| Token | 值 | 用途 |
|-------|------|------|
| `--text-on-dark` | `rgba(255,255,255,0.85)` | 步驟指示器、投影片上的主要白色文字 |
| `--text-on-dark-muted` | `rgba(255,255,255,0.5)` | 箭頭按鈕、placeholder、輔助文字 |

**命名原則：** 用途導向（`text-secondary`）而非色值導向（`grey-600`）。

**總計 17 個 token。**

---

## 2. 字型與排版

### 字型堆疊

| Token | 值 |
|-------|------|
| `--font` | `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif` |

Google Fonts 為主、macOS/iOS 次之、Windows 兜底。

### 字級 Scale（4 級）

| Token | 值 | 用途 |
|-------|------|------|
| `--text-sm` | `14px` | 副文字、banner、placeholder alt |
| `--text-base` | `16px` | 預設正文、Tab、投影片說明、按鈕 |
| `--text-lg` | `18px` | 卡片標題、投影片步驟標題、結束按鈕 |
| `--text-xl` | `24px` | 結束畫面標題 |

### 字重

| Token | 值 | 用途 |
|-------|------|------|
| `--weight-normal` | `400` | 正文 |
| `--weight-medium` | `500` | Tab、步驟指示器 |
| `--weight-semibold` | `600` | 按鈕、grid header |
| `--weight-bold` | `700` | 卡片標題、投影片標題、結束標題 |

### 行高

| 情境 | 值 |
|------|------|
| 正文（投影片說明） | `1.5` |
| 標題（卡片標題） | `1.3` |

---

## 3. 間距、圓角、陰影

### 間距 Scale（8px 基底）

| Token | 值 | 用途 |
|-------|------|------|
| `--space-xs` | `8px` | 元素內緊湊間距 |
| `--space-sm` | `16px` | 卡片內距、按鈕 padding |
| `--space-md` | `24px` | 區塊間距 |
| `--space-lg` | `32px` | 主要區段間距 |
| `--space-xl` | `48px` | 頁面頂部留白 |

**原則：** 所有間距為 8 的倍數。

### 圓角

| Token | 值 | 用途 |
|-------|------|------|
| `--radius-sm` | `4px` | Skeleton 文字區塊 |
| `--radius` | `8px` | 卡片、按鈕、一般容器 |
| `--radius-pill` | `20px` | 分類 Tab（膠囊形） |

### 陰影

| Token | 值 | 用途 |
|-------|------|------|
| `--shadow` | `0 1px 3px rgba(0,0,0,0.12)` | 卡片靜止 |
| `--shadow-hover` | `0 2px 8px rgba(0,0,0,0.2)` | 卡片 hover |

### Z-Index 層級

| 層級 | 值 | 元素 |
|------|------|------|
| 基底 | `auto` | 一般內容 |
| 導航 | `5` | 箭頭按鈕 |
| 固定 | `10` | 投影片導航列 |
| 覆蓋 | `20` | 結束畫面 |
| 系統 | `100` | Banner（離線/更新） |

### 轉場動畫

| Token | 值 | 用途 |
|-------|------|------|
| `--transition` | `200ms ease` | 通用轉場（hover、view 切換） |
| `--transition-fast` | `100ms ease` | 箭頭按鈕 hover |
| `--transition-image` | `150ms ease` | 圖片淡入 |

---

## 4. 響應式斷點

| 斷點 | 目標裝置 | 格線 | 特殊調整 |
|------|---------|------|---------|
| `≥ 1025px` | 桌機 | 3 欄 | 投影片圖片 max-width 800px |
| `481–1024px` | 平板 | 2 欄 | — |
| `≤ 480px` | 手機 | 1 欄 | 箭頭按鈕 40×40px / 20px 字、文字面板 max-height 35% |

**觸控目標：** 所有互動元素最小 44×44px（WCAG 2.1 SC 2.5.5）。

---

## 5. 元件規格

### 5.1 分類 Tab 列

- **外觀：** 膠囊形（`--radius-pill`）、水平可捲動、隱藏捲軸
- **狀態：**
  - 活躍：`--accent` 背景 + `--text-light` 文字
  - 非活躍：透明背景 + `--text-muted`
  - Hover：`--bg-skeleton` 背景
- **無障礙：** `role="tablist"` 容器、`role="tab"` 各按鈕、`aria-selected` 標記當前

### 5.2 衛教卡片

- **佈局：** 16:9 縮圖 + 標題文字
- **狀態：**
  - 靜止：`--shadow`
  - Hover：`translateY(-2px)` + `--shadow-hover`
  - 載入中：skeleton shimmer 動畫
- **連結：** `<a href="#/{id}">`，整張卡片可點擊
- **圖片錯誤 fallback：** `--border-light` 背景

### 5.3 投影片檢視器

- **佈局：** 全螢幕深色背景（`--bg-dark`）、圖片 `object-fit: contain` 置中
- **導航箭頭：** `--text-on-dark-muted` → hover `--text-light`
- **文字面板：** 底部覆蓋層（`--overlay`）、max-height 30%（手機 35%）、溢出可捲動
- **步驟指示器：** `--text-on-dark`、`aria-live="polite"`
- **結束畫面：** z-index 20、標題 + 返回按鈕

### 5.4 系統 Banner

- **離線 banner：** 底部固定、`--bg-muted` 背景 + `--border-light` 上邊框
- **更新 banner：** 頂部固定、`--accent` 背景 + `--text-light` 文字

### 5.5 觸控與手勢

| 參數 | 值 |
|------|------|
| 滑動閾值 | 50px 最小位移 |
| 方向 | 水平位移 > 垂直位移 |
| 時間限制 | 500ms 內完成 |
| 多指處理 | 偵測到雙指時不觸發（保護 pinch-to-zoom） |

### 5.6 鍵盤導航

| 按鍵 | 動作 | 適用情境 |
|------|------|---------|
| `→` | 下一步 | 投影片模式 |
| `←` | 上一步 | 投影片模式 |
| `Escape` | 返回列表 | 投影片模式 |

---

## 6. 資料格式

### 索引檔 `procedures/index.json`

```json
{
  "categories": [
    { "id": "surgery", "title": "手術" },
    { "id": "ent", "title": "耳鼻喉" },
    { "id": "weight", "title": "減重" },
    { "id": "functional", "title": "功能醫學" }
  ],
  "procedures": [
    {
      "id": "appendectomy",
      "title": "闌尾切除術",
      "category": "surgery",
      "thumbnail": "images/appendectomy/thumb.webp"
    }
  ]
}
```

- `category` 必須對應某個 `categories[].id`
- `thumbnail` 路徑格式：`images/{id}/thumb.webp`

### 個別衛教檔 `procedures/{id}.json`

```json
{
  "id": "appendectomy",
  "title": "闌尾切除術",
  "steps": [
    {
      "image": "images/appendectomy/step1.webp",
      "title": "步驟標題",
      "description": "步驟說明文字",
      "alt": "圖片替代文字"
    }
  ]
}
```

### 圖片規範

| 項目 | 規格 |
|------|------|
| 格式 | WebP |
| 縮圖命名 | `thumb.webp` |
| 步驟命名 | `step{N}.webp`（1-indexed） |
| 目錄 | `images/{procedure-id}/` |
| 縮圖顯示 | 16:9（CSS `aspect-ratio`） |
| 步驟顯示 | `object-fit: contain` |

---

## 7. 無障礙標準

| 標準 | 要求 |
|------|------|
| 配色對比 | WCAG AA（正文 4.5:1、大字 3:1） |
| 觸控目標 | 最小 44×44px |
| 鍵盤存取 | 所有互動功能可用鍵盤操作 |
| ARIA 角色 | Tab 用 `role="tablist/tab"` + `aria-selected` |
| 即時通知 | 步驟變更用 `aria-live="polite"` |
| 語言標記 | `lang="zh-TW"` |

---

## 8. 新增衛教項目 Checklist

1. 建立圖片目錄 `images/{id}/`，放入 `thumb.webp` + `step1.webp` ~ `stepN.webp`
2. 建立衛教 JSON `procedures/{id}.json`，依第 6 節 schema 填入步驟資料
3. 更新索引 `procedures/index.json`，在 `procedures` 陣列新增條目
4. 驗證 `category` 對應已存在的分類 ID
5. 測試：開啟首頁 → 卡片出現 → 點擊進入投影片 → 翻完所有步驟 → 結束畫面
