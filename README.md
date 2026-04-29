# 診間解說 · Explain

診間病情溝通輔助系統 —— 衛教圖卡、手術流程、醫學計算機，三合一的 Vanilla JS PWA。

線上版：<https://lemonicefate.github.io/entexplainpage/>

---

## 特色

- **純前端 PWA**：無後端、無打包工具，`index.html` + `js/app.js` 即可跑。
- **離線可用**：Service Worker 預載核心資源，iPad 連線不穩也能解說。
- **Reader 模式**：仿電子書體驗——點左右換頁、點中間叫出工具列、下方拖拉桿快速跳頁、3 秒後工具自動淡出。
- **診間工具**：畫筆、聚光燈、雷射指標，支援滑鼠、觸控、Apple Pencil（Pointer Events 統一處理）。
- **內建計算機**：BMI、血脂 / Statin 給付判讀、小兒劑量。

---

## 專案結構

```
entexplainpage/
├── index.html               # 入口
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker（必須放 repo 根部，scope 才對）
├── css/style.css            # Design tokens + 全站樣式
├── js/app.js                # IIFE 單檔應用程式
├── procedures/
│   ├── index.json           # 分類 + 衛教/手術列表
│   ├── snore.json           # 單篇步驟資料（每篇一檔）
│   └── nasal-obstruction.json
├── images/{id}/             # 對應的縮圖與步驟圖
│   ├── thumb.webp           # 也接受 png/jpg
│   └── step1.webp ...
├── admin.html               # 網頁版編輯器（搭配 scripts/admin.js）
├── scripts/admin.js         # 本機編輯用 API server
├── tests/
│   ├── unit/                # vitest + jsdom
│   └── e2e/                 # Playwright
├── DESIGN.md                # 設計系統與元件規格
├── CHANGELOG.md             # 版本紀錄
├── TODOS.md                 # 待辦與延後決策
└── VERSION                  # 當前版本號
```

---

## 本機開發

需求：Node.js 18+。

```bash
# 安裝測試相依
npm install

# 本機啟動（serve 在 port 3000）
npm run serve
# 開啟 http://localhost:3000

# 網頁版編輯器（port 3001 同時服務主站與編輯器）
#   主站  → http://localhost:3001/
#   編輯器 → http://localhost:3001/admin.html
npm run admin
```

> Service Worker 只在 production 生效（`location.hostname !== 'localhost'`），本機不用擔心快取。

---

## 測試

### 單元測試（vitest + jsdom）

```bash
npm test              # 跑一次
npm run test:watch    # watch 模式
```

涵蓋：Service Worker 路徑、manifest scope、app 初始化、Reader 模式 DOM、CSS tokens、工具列互動等。

### E2E 測試（Playwright）

```bash
# 首次需要安裝瀏覽器
npx playwright install

npm run test:e2e
```

涵蓋完整使用者流程：首頁、播放器、計算機、Reader 模式（tap zones、scrubber、auto-hide、pen drawing）。

**Commit 前兩種都要過。** 加新功能時，對照 `tests/unit/app.test.js` 的 describe 區塊補測。

---

## 部署

部署方式：**GitHub Pages**（`main` 分支 push 後自動發佈）。

```bash
# 1. 改完檔案 → 本地測試
npm test && npm run test:e2e

# 2. 更新版本與 changelog
echo "0.2.3.0" > VERSION      # 照 MAJOR.MINOR.PATCH.MICRO 格式
# 編輯 CHANGELOG.md 新增該版本段落

# 3. 合併到 main 並 push
git push origin main
```

建議走 Pull Request 流程（本專案既有做法）：

```bash
git checkout -b feature/xxx
# ... 提交 commits
gh pr create --base main
# 評審通過後 squash merge
gh pr merge --squash --delete-branch
```

部署完成後到 iPad Safari 加到主畫面測一輪（Reader 模式、工具、PWA 離線、Add to Home Screen 網址）。

---

## 新增衛教文章 / 手術流程圖

衛教文章（`type: "explain"`）與手術流程圖（`type: "surgery"`）結構完全相同，只差分類標籤。

### 步驟

**1. 放圖**

在 `images/{id}/` 建資料夾（`id` 為英文小寫 + 連字號），放入：

- `thumb.webp` —— 首頁縮圖（建議 800x600）
- `step1.webp`、`step2.webp`... —— 每個步驟一張

格式用 `webp` 壓縮效率最好，檔案控制在 200KB 以內。

**2. 新增步驟資料**

在 `procedures/` 新增 `{id}.json`：

```json
{
  "id": "tonsillectomy",
  "title": "扁桃腺切除術",
  "steps": [
    {
      "image": "images/tonsillectomy/step1.webp",
      "title": "扁桃腺位置",
      "description": "扁桃腺位於喉嚨兩側，是免疫系統的一部分。",
      "alt": "口咽解剖圖，標示扁桃腺位置"
    },
    {
      "image": "images/tonsillectomy/step2.webp",
      "title": "何時需要切除",
      "description": "反覆發炎、阻塞性睡眠呼吸中止症、懷疑惡性病變時考慮手術。",
      "alt": "發炎扁桃腺示意圖"
    }
  ]
}
```

每個步驟四個欄位：`image`、`title`、`description`、`alt`（為無障礙與圖片載入失敗時的替代說明，必填）。

**3. 註冊到索引**

編輯 `procedures/index.json`，在 `procedures` 陣列加一筆：

```json
{
  "id": "tonsillectomy",
  "title": "扁桃腺切除術",
  "subtitle": "睡眠呼吸中止 · 4 步驟",
  "category": "ent",
  "type": "surgery",
  "region": "頭頸",
  "slides": 4,
  "thumbnail": "images/tonsillectomy/thumb.webp"
}
```

欄位：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | ✅ | 必須與 JSON 檔名、`images/{id}/` 資料夾名一致 |
| `title` | ✅ | 卡片標題 |
| `category` | ✅ | 對應 `categories` 其中之一：`surgery` / `ent` / `weight` / `functional` |
| `type` | ✅ | `explain`（解釋病情）或 `surgery`（手術流程）——決定首頁篩選籤 |
| `thumbnail` | ✅ | 首頁卡片縮圖路徑 |
| `subtitle` | 選填 | 卡片副標；省略則不顯示 |
| `region` | 選填 | 身體區域標記；省略時卡片改顯示 `type` |
| `slides` | 選填 | 步驟數；省略時卡片顯示 `slides`，提供時須等於步驟 JSON 的 `steps.length` |

新增分類就編 `categories` 陣列。
> 資料慣例：snore 是早期完整範例（含 subtitle / region / slides），新加入的條目目前只填必填欄位。

**4. 或使用網頁版編輯器**

不想手改 JSON：

```bash
npm run admin
# 編輯器：http://localhost:3001/admin.html
# 主站  ：http://localhost:3001/   （同一個 port，方便邊改邊看）
```

可以新增 / 編輯 / 刪除衛教、拖拉調整步驟順序、上傳或替換步驟圖、即時預覽、儲存回 `procedures/*.json`。完成後再 `git diff` 檢查、commit。

---

## 新增計算機

計算機是**寫在 `js/app.js` 裡的靜態邏輯**（不走 JSON），因為每個計算機的輸入欄位、規則邏輯、判讀文字都不同，沒必要為了 DRY 硬做資料驅動。

現有三支：`bmi`、`lipid`、`peds-dose`，分別對應 `renderBmi()`、`renderLipid()`、`renderPeds()`。

### 步驟

**1. 登記 metadata**

`js/app.js` 找到 `CALCULATORS` 陣列（約第 76 行），加一筆：

```js
var CALCULATORS = [
  {id:'bmi',       title:'BMI 與肥胖分級',  subtitle:'...', type:'calc', kind:'calc'},
  {id:'lipid',     title:'血脂風險...',   subtitle:'...', type:'calc', kind:'calc'},
  {id:'peds-dose', title:'小兒劑量（mg/kg）', subtitle:'...', type:'calc', kind:'calc'},
  // 新增：
  {id:'egfr',      title:'eGFR 腎功能估算', subtitle:'CKD-EPI 2021', type:'calc', kind:'calc'}
];
```

**2. 加到分頁列**

同檔案 `calcDefs` 陣列（約第 818 行）：

```js
var calcDefs = [
  { id: 'bmi',       label: 'BMI' },
  { id: 'lipid',     label: '血脂風險' },
  { id: 'peds-dose', label: '小兒劑量' },
  { id: 'egfr',      label: 'eGFR' }
];
```

**3. 接 router**

`enterCalc(id)` 函式（約第 836 行）加一個分支：

```js
if (id === 'bmi') renderBmi();
else if (id === 'lipid') renderLipid();
else if (id === 'peds-dose') renderPeds();
else if (id === 'egfr') renderEgfr();   // ← 新增
```

**4. 寫 render 函式**

仿照 `renderBmi()`（約 975 行）。可用的共用 helpers：

- `field(label, hint, value, unit, onInput, opts)` —— 數字輸入欄位
- `check(label, checked, onChange)` —— checkbox
- `section(label, children)` —— 小節標題
- `ruleList(rules)` —— 規則清單（顯示 ● / ○）
- `resultCard({ value, unit, tag, tagColor })` —— 結果卡片
- `summary(text)` —— 建議摘要區塊
- `explainBlock(parts)` —— 逐行說明（可混合粗體）

最小樣板（用 helpers，不用手拼字串）：

```js
function renderEgfr() {
  var state = { age: 60, scr: 1.0 };

  function render() {
    var egfr = computeEgfr(state);   // 依 CKD-EPI 2021 計算

    while (calcBody.firstChild) calcBody.removeChild(calcBody.firstChild);
    calcBody.appendChild(el('div', { class: 'calc-card' }, [
      el('h3', null, ['eGFR 腎功能估算']),
      section('輸入', [
        field('年齡', null, state.age, '歲',
          function (v) { state.age = v; render(); }, { min: 0, max: 120 }),
        field('肌酸酐', 'serum Cr', state.scr, 'mg/dL',
          function (v) { state.scr = v; render(); }, { step: 0.01 })
      ]),
      resultCard({ value: egfr.toFixed(1), unit: 'mL/min/1.73m²', tag: stage(egfr) })
    ]));
  }

  render();
}
```

**5. 補測試**

`tests/unit/app.test.js` 加一條：

```js
test('eGFR calculator tab exists', async () => {
  document.location.hash = '#/calc/egfr';
  await waitForHash();
  expect(document.querySelector('.calc-card h3').textContent).toContain('eGFR');
});
```

### 臨床風險分級原則

每個計算機風險等級不同，測試覆蓋策略要對齊（詳見 `TODOS.md`）：

- **依據明確指引**（例：BMI 分級依國健署）→ 必須有邊界值測試。
- **健保給付判讀**（例：lipid/statin）→ 必須測給付條件每一條分支。
- **估計型公式**（例：小兒 mg/kg、自製 ASCVD 估算）→ 不鑽牛角尖到單元測試寫規格；明確註記「僅供參考」。

---

## 版本與 Changelog

- 版本號：`MAJOR.MINOR.PATCH.MICRO`，寫在 `VERSION` 單檔。
  - MAJOR：重大重構或破壞性變更
  - MINOR：新功能（新計算機、新流程圖）
  - PATCH：Bug 修復
  - MICRO：文案、樣式微調
- 每次 release 在 `CHANGELOG.md` 寫一段：`### Added` / `### Fixed` / `### Changed` / `### Upgrade notes`。
- `DESIGN.md` 是設計系統與元件規格的 source of truth，改 UI 時同步更新。

---

## 常用指令一覽

```bash
npm test              # 單元測試
npm run test:e2e      # E2E 測試
npm run serve         # 本機預覽 http://localhost:3000
npm run admin         # 網頁版編輯器 http://localhost:3001
```

---

## License

私人專案，僅限診間內部使用。圖文內容版權歸原作者所有。
