# DESIGN.md — 診間解說 · Explain

> 設計系統文件：色彩 token、元件規格、無障礙標準、資料格式。
> 目標讀者：自己（未來回顧用）+ 其他可能貢獻 UI 的開發者。

---

## 0. 產品概述

**診間解說（Clinic Explain）** 是給門診醫師在診間使用的溝通輔助工具。三大功能：

| 模組 | 說明 |
|------|------|
| 解釋病情（explain） | 多頁圖卡，解剖圖、分級、治療選擇 |
| 手術流程（surgery） | 步驟式圖卡，從術前到術後 |
| 醫學計算機（calc） | BMI、血脂風險 + Statin 給付、小兒劑量 |

**設計取向：** Warm Teal × Peach。專業、眼睛舒適、適合長時間閱讀。

---

## 1. 色彩系統

CSS custom property 定義於 `:root`，禁止 hardcode hex（測試會擋）。

### 基底
| Token | 值 | 用途 |
|-------|----|------|
| `--fg` | `#0f2a42` | 主要文字、深色背景（播放器） |
| `--teal` | `#0e7c7b` | 品牌主色、按鈕、結果卡標頭 |
| `--teal-deep` | `#0a6968` | 漸層末端、hover |
| `--teal-2` | `#4a9e94` | section label、次要 teal |
| `--bg` | `#ffffff` | 頁面背景 |
| `--muted` | `#56706c` | 次要文字 |

### Ink 階層（深淺三級）
| Token | 值 | 用途 |
|-------|----|------|
| `--ink` | `#1a3942` | 卡片標題、品牌文字 |
| `--ink-2` | `#3a5064` | 表單 label、內文 |
| `--ink-3` | `#8aa3a0` | placeholder、計數、kbd |

### Surface / 線條
| Token | 值 | 用途 |
|-------|----|------|
| `--surface` | `#ffffff` | 卡片底色 |
| `--surface-pin` | `#fffdf5` | 釘選卡片米黃底 |
| `--line` | `#eaf2ef` | 一般邊框 |
| `--line-strong` | `#d7e4e0` | 表單邊框 |
| `--tint-1` | `#f0f7f4` | 輸入底色、淺背景 |
| `--tint-2` | `#f5faf8` | tab bar 底、摘要底 |

### Accent
| Token | 值 | 用途 |
|-------|----|------|
| `--peach` | `#e5966a` | 播放器工具 active |
| `--peach-soft` | `#fbe7d9` | 手術 tag 底 |
| `--peach-ink` | `#a65a2e` | 手術 tag 文字 |
| `--gold` | `#f2c94c` | focus ring、釘星 |
| `--gold-soft` | `#fef6dc` | 釘按鈕 active 底 |

### Player 深色面
| Token | 值 |
|-------|----|
| `--player-bg` | `#0f2a42` |
| `--player-bg-2` | `#1a3a55` |
| `--player-bg-3` | `#081a2c` |

### 語意色（計算結果判讀）
| 狀態 | 前景 | 背景 | 符號 |
|------|------|------|------|
| `ok` | `#1a7a4a` | `#e7f5ef` | ● |
| `warn` | `#a07a14` | `#fdf4d9` | ■ |
| `danger` | `#c44a2e` | `#fde6e0` | ▲ |
| `info` | `#0e7c7b` | `#e7f3f1` | ● |

### Tag 標籤色
| 類型 | 背景 token | 文字 token |
|------|-----------|-----------|
| `explain` | `--tag-explain-bg` `#e7f3f1` | `--tag-explain-fg` `#0e7c7b` |
| `surgery` | `--tag-surgery-bg` `#fbe7d9` | `--tag-surgery-fg` `#a65a2e` |
| `calc` | `--tag-calc-bg` `#efe9fb` | `--tag-calc-fg` `#6b4ac7` |

---

## 2. 字型與排版

| Token | 用途 |
|-------|------|
| `--font` `Noto Sans TC, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif` | 主字型（中文 + 一般 UI） |
| `--font-serif` `Instrument Serif, "Cormorant Garamond", Georgia, serif` | 品牌副標 "Explain" |
| `--font-mono` `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | 頁碼、kbd、placeholder label |

### 字級
| 用途 | 值 |
|------|------|
| 卡片副文字、tag、kbd | 11–12px |
| 內文 | 13–14px |
| 卡片標題 | 15px |
| 搜尋輸入 | 17px |
| 計算機 H3 | 20px |
| 頁面標題（投影片中央） | 28px |
| 結果卡數值 | 42px |

### 字重
| 值 | 用途 |
|------|------|
| 400 | 正文 |
| 500 | label、tab |
| 600 | 卡片標題、tag、按鈕 |
| 700 | H3、品牌、結果數值 |

---

## 3. 圓角、陰影、動態

| Token | 值 | 用途 |
|-------|------|------|
| `--r-sm` | 6px | kbd 鍵帽 |
| `--r` | 10px | 輸入框、check、tool 按鈕 |
| `--r-md` | 14px | 卡片、結果卡、搜尋框 |
| `--r-lg` | 20px | 大型容器 |
| `--r-pill` | 999px | tag、chip、按鈕 pill |

| Token | 值 |
|-------|------|
| `--shadow-card` | `0 1px 2px rgba(15,42,66,0.04)` |
| `--shadow-hover` | `0 16px 30px -20px rgba(15,42,66,0.2)` |
| `--shadow-pop` | `0 12px 32px -12px rgba(15,42,66,0.18)` |

| Token | 值 | 用途 |
|-------|------|------|
| `--t-fast` | `100ms ease` | 細微互動 |
| `--t` | `150ms ease` | 通用 |
| `--t-slow` | `220ms ease` | 較大過渡 |

**Focus ring：** `2px solid var(--gold)`, offset `2px`（鍵盤可見）。

---

## 4. 元件規格

### 4.1 首頁（HomePage）

```
┌─────────────────────────────────────────┐
│ [衛] 診間解說 Explain        Dr. 王 ○ │  ← brand + user
├─────────────────────────────────────────┤
│       ┌─🔍 搜尋 (⌘K) ──────────┐        │
│       └────────────────────────┘        │
│         ⌘K · Esc · Enter                │
│                                         │
│ [全部] [★釘選 (3)] [病情] [手術] [計算]  │
│                              42 個項目  │
│ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │ 圖   │ │ 圖   │ │ 圖   │  …          │
│ │ 標題 │ │ 標題 │ │ 標題 │              │
│ │ tag ★│ │ tag ★│ │ tag ★│              │
│ └──────┘ └──────┘ └──────┘              │
└─────────────────────────────────────────┘
```

- 卡片懸停：`translateY(-2px)` + `--shadow-hover`
- 釘選卡片底色：`--surface-pin`（米黃）
- ⌘K 聚焦搜尋；Esc 清除查詢
- Filter 排序：釘選優先 → 中文標題 localeCompare

### 4.2 投影片播放器（PlayerPage）

```
┌────────────────────────────────────────────┐
│ ← 返回列表                                  │  ← absolute top-left
│  01 / 04                       專案標題     │
│                              page subtitle  │
│      ┌─────────────────────┐               │
│      │  條紋深色背景         │               │
│      │  ┌─────────────┐    │               │
│      │  │ 圖片 / 標題  │    │               │
│      │  │ 說明文字     │    │               │
│      │  └─────────────┘    │               │
│      └─────────────────────┘               │
│                                            │
│ [上一頁] [下一頁]    [畫筆][聚][雷][X]      │
│ ────── 縮圖列 ─────────────────────────    │
└────────────────────────────────────────────┘
```

- 深色背景 `--player-bg` (#0f2a42)
- Frame 條紋背景：對角線重複條紋 `linear-gradient(135deg, ...)` + `--player-bg-2`
- 工具：`pen` / `spot` / `laser` / `exit`
- Active 工具：`--peach` 背景
- 縮圖列：`--player-bg-3` 底，active 縮圖 `--peach` 邊框
- 雷射指標：紅色發光點跟隨游標（10px / box-shadow blur）
- 聚光燈：`radial-gradient` 暗化 overlay，140px 透明半徑

### 4.3 計算機頁（CalcPage）

```
┌──────────────────────────────────────────┐
│ ← 返回   醫學計算機                       │
│                                          │
│ [BMI] [血脂風險] [小兒劑量]               │  ← tab in pill
│                                          │
│ ┌──────────────────┐  ┌────────────┐     │
│ │ INPUT CARD       │  │ RESULT     │     │
│ │  欄位 / checkbox │  │  數值      │     │
│ │  (左欄表單)       │  │  判讀      │     │
│ │                  │  │  規則      │     │
│ │                  │  │  摘要      │     │
│ │                  │  │  按鈕      │     │
│ └──────────────────┘  └────────────┘     │
│                       (sticky)           │
└──────────────────────────────────────────┘
```

- 兩欄 grid：`1fr 360px`，結果卡 `position: sticky`
- 結果卡頭部：teal 漸層
- 規則 RuleList：`●` 符合（綠）/ `○` 不符合（灰）
- 摘要：虛線邊框 + `--tint-2` 底色
- 行動按鈕：「投影給病人看」（primary teal）/「列印」（ghost）
- ≤768px：單欄；結果卡取消 sticky

### 4.4 共用元件清單

| 元件 | class / id |
|------|-----------|
| Brand 標誌 | `.brand`, `.brand-mark`, `.brand-name`, `.brand-sub` |
| 搜尋框 | `.search` + `.search-icon` |
| 篩選 chip | `.chip` (`[aria-selected]`) |
| 卡片 | `.card`, `.card-thumb`, `.card-info`, `.card-title`, `.card-sub`, `.card-foot` |
| Tag pill | `.tag.tag-explain` `.tag-surgery` `.tag-calc` |
| Pin button | `.pin-btn`（`.is-on` 高亮） |
| Skeleton | `.skeleton-thumb` `.skeleton-line` |
| 計算欄位 | `.field`, `.field-label`, `.field-input`, `.field-unit` |
| Checkbox | `.check`（`.is-on` 高亮） |
| 區塊 label | `.section-label` |
| 結果卡 | `.result-card`, `.result-head`, `.verdict`, `.rules`, `.rule`, `.summary` |
| Disclaimer | `.result-disclaimer` |
| Player tool | `.tool[data-tool]`（`.is-active`） |
| Thumb | `.thumb`（`.is-active`） |
| Banner | `.banner-offline` `.banner-update` |

---

## 5. 鍵盤快捷鍵

| 按鍵 | 所在頁面 | 功能 |
|--------|---------|------|
| `⌘K` / `Ctrl+K` | 首頁 | 聚焦搜尋列 |
| `Esc` | 搜尋框 | 清除（再按一次：失焦） |
| `←` / `→` / `Space` | 播放器 | 上 / 下一頁 |
| `Esc` | 播放器 / 計算機 | 返回首頁 |
| `1`–`9` | 播放器 | 跳到第 N 頁 |
| `L` | 播放器 | 切換雷射指標 |
| `S` | 播放器 | 切換聚光燈 |
| `P` | 播放器 | 切換畫筆（toggle，繪圖功能 TODO） |

---

## 6. 路由（hash-based，無 router 套件）

| Hash | 視圖 |
|------|------|
| `` 或 `#` | 首頁 |
| `#/<id>` | 播放器，載入 `procedures/<id>.json` |
| `#/calc` 或 `#/calc/<id>` | 計算機（id: `bmi` / `lipid` / `peds-dose`） |

LocalStorage：
- `clinic_pins`：已釘選 id 陣列

---

## 7. 響應式

| 斷點 | 調整 |
|------|------|
| ≤ 1024px | grid `minmax(220px, 1fr)` |
| ≤ 768px | 計算機改單欄、結果卡取消 sticky、欄位 grid 改單欄、頁面 padding 減 |
| ≤ 480px | grid 單欄、按鈕 padding 縮小、縮圖縮小 |

**觸控目標：** 主要按鈕最小 44×44px（WCAG 2.1 SC 2.5.5）。

---

## 8. 資料格式

### `procedures/index.json`

```json
{
  "categories": [
    { "id": "surgery", "title": "手術" },
    { "id": "ent", "title": "耳鼻喉" }
  ],
  "procedures": [
    {
      "id": "appendectomy",
      "title": "闌尾切除術",
      "subtitle": "腹腔鏡微創 · 5 步驟",
      "category": "surgery",
      "type": "surgery",
      "region": "腹",
      "slides": 5,
      "thumbnail": "images/appendectomy/thumb.webp"
    }
  ]
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `id` | ✓ | 唯一識別 |
| `title` | ✓ | 卡片主標 |
| `subtitle` | — | 卡片副文字（推薦填寫） |
| `category` | ✓ | 對應 `categories[].id` |
| `type` | ✓ | `explain` / `surgery`（決定 tag 顏色與篩選） |
| `region` | — | 解剖部位（耳/鼻/喉/腹…） |
| `slides` | — | 步驟數，給卡片佔位顯示 |
| `thumbnail` | ✓ | 16:9 縮圖路徑 |

### 個別 `procedures/<id>.json`

```json
{
  "id": "appendectomy",
  "title": "闌尾切除術",
  "steps": [
    { "image": "images/appendectomy/step1.webp",
      "title": "步驟標題",
      "description": "步驟說明文字",
      "alt": "圖片替代文字" }
  ]
}
```

### 圖片規範
| 項目 | 規格 |
|------|------|
| 格式 | WebP |
| 縮圖 | `thumb.webp` |
| 步驟 | `step{N}.webp`（1-indexed） |
| 目錄 | `images/{procedure-id}/` |

---

## 9. 無障礙

| 標準 | 要求 |
|------|------|
| 對比 | WCAG AA（正文 4.5:1、大字 3:1） |
| 觸控目標 | 最小 44×44px |
| 鍵盤 | 所有互動可達；focus-visible ring 顯示 |
| ARIA | filter chips 用 `role="tablist"` + `aria-selected`；step indicator `aria-live="polite"` |
| 語言 | `lang="zh-TW"` |
| outline | `:focus-visible` 顯示 gold ring；`outline:none` 在測試會被攔下，僅允許在已恢復視覺指引的情境用 `outline:0` |

---

## 10. 新增衛教項目 Checklist

1. 建立圖片目錄 `images/{id}/`，放入 `thumb.webp` + `step1.webp` ~ `stepN.webp`
2. 建立衛教 JSON `procedures/{id}.json`（依 §8 schema）
3. 更新索引 `procedures/index.json`，新增條目並指定 `type` 與（建議）`subtitle` / `region` / `slides`
4. 驗證 `category` 對應已存在的分類 ID
5. 測試流程：開啟首頁 → 卡片出現 → 點擊進入播放器 → 翻完所有步驟 → 結束畫面

---

## 11. 待實作 / 下一步

- [ ] 畫筆工具實際繪圖功能（Canvas）
- [ ] 「投影給病人看」全螢幕模式（隱藏醫師操作面板）
- [ ] 計算機列印版型（@media print）
- [ ] 更多計算機：CHA₂DS₂-VASc、CrCl、IV 流速、GLP-1 NHI、FESS NHI
- [ ] 流程圖分支播放（A→D / B→1 條件式跳頁）
- [ ] 搜尋列 ↑↓ 導覽候選結果
- [ ] 多醫師 / 多科室自訂衛教
