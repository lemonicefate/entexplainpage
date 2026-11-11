# 衛教頁工作流比較原型

> **THROWAWAY PROTOTYPE** — 這個原型只用來回答「直接產圖與模板合成，哪一種較適合本專案？」不會讀寫正式 procedure，也不代表最終實作。

## 啟動

```bash
npm run prototype:education-pages
```

開啟（此原型使用專案既有、無額外依賴的管理端伺服器）：

```text
http://localhost:3001/admin-education-prototype.html?variant=direct&topic=menieres
```

`npm run prototype:education-pages` 會啟動既有 `scripts/admin.js` 服務，不需要 `npx` 下載或安裝 `serve`。網址保留 `.html` 與 query，避免 clean-URL redirect 移除測試狀態。

## 操作

- 步驟 1：依疾病比較、生活建議、規則速查選擇示範主題。
- 步驟 2：直接選擇 A／B／C 工作流；鍵盤 `←` / `→` 仍可快速切換。
- 流感的敘事模板會分成兩頁，以預覽下方的上一頁／下一頁控制完整檢視六項內容。
- 展開「檢視主題完整文字稿」可在小螢幕閱讀全部文案與代碼。
- URL 會保留 `variant`、`topic`，以及敘事模板的 `editorialPage`，可直接分享特定組合。
- 手機預覽可用「放大預覽」以 1:1 檢視；敘事頁翻頁控制在畫布下方，完整文字稿可展開閱讀。

## 資訊架構參考

2026-11-11 以瀏覽器檢視 [MDCalc](https://www.mdcalc.com/) 首頁：主要導覽以計算工具搜尋為入口，再提供 Trending、依專科瀏覽和全站工具分類。此原型借用其「先給主要任務入口，再以清楚分類探索」的順序，調整為先選衛教主題、再明確選擇呈現工作流，並在同頁放預覽、版本狀態和完整文字稿。直接狀態 URL 可供測試員分享同一個主題與工作流組合。

參考 MDCalc 的資訊層級與分類方式，不複製醫學計算機的內容分類或視覺品牌。此處三個工作流是比較工具，不是最終編輯器；正式衛教產圖仍依 [ADR-0006](adr/0006-use-approved-ai-visual-masters-for-education-pages.md) 的核准視覺母版與醫師審核流程處理。

### 變體

| Query | 內容 |
|---|---|
| `variant=direct` | 圖片模型直接產生完整內容區；系統只加共同品牌框架 |
| `variant=editorial` | JSON + HTML/CSS 的插圖／敘事雙區模板；超量時拆頁 |
| `variant=modular` | JSON + HTML/CSS 的卡片／速查模板 |

### 主題

| Query | 用來測試 |
|---|---|
| `topic=menieres` | 解剖插圖與三項疾病比較 |
| `topic=oral` | 四項生活建議與警訊 |
| `topic=influenza` | 六組高密度規則與代碼 |

## 共同框架

三個變體都鎖定相同的方形畫布、頁首、頁尾、安全邊界、主品牌、發布者、主題名稱、頁碼與極小字衛教聲明。完整來源只存在主題資料，不顯示在圖片。

直接產圖路徑只能控制中間內容區，不得生成共同框架。模板合成路徑的圖片模型只負責無文字插圖，所有可讀文字由瀏覽器渲染。

## 評分方式

輸出品質比較每一輪以相同內容同時生成兩條路徑，分別以 1–5 分記錄：

1. 視覺吸引力
2. 跨頁一致性
3. 文字與醫療代碼正確率
4. 修改成本
5. 生成時間
6. 相同輸入重跑的穩定性

至少重跑三輪後才決定主要工作流。不要只挑每條路徑最漂亮的一張比較；應比較完整序列與失敗案例。介面 UAT 則以 1–10 分記錄找入口、理解狀態、比較效率、內容可讀性、鍵盤與手機操作及整體滿意度，並分開記錄實際操作證據。

### 2026-11-11 UAT 修正

| 測試角色 | 第一輪 | 修正後 | 最終觀察 |
|---|---:|---:|---|
| 資訊架構／無障礙 | 6.3/10 | 9.2 → 9.3 → **9.7/10** | 主題／工作流好找；手機 dialog、鍵盤焦點、live status、44px 控制與分享 URL 均通過。 |
| 耳鼻喉科臨床醫師 | 7/10 | **9/10** | 敘事六類分頁完整；手機放大畫布可讀，剩餘需左右滑看完整 1:1 版面。 |
| 衛教內容管理者 | 8/10 | **9.5/10** | A/B/C、文字稿、URL 狀態與手機放大操作清楚；無阻塞問題。 |

第一輪共通問題是敘事模板只顯示前三項卻宣稱拆成兩頁，以及手機固定工作流列遮住狀態資訊。修正加入實際 3＋3 分頁、頁碼同步、直接選擇 A/B/C、44px 以上操作目標、完整文字稿、放大 1:1 dialog、URL 狀態與 `aria-live` 朗讀。管理者回饋後，狀態標題與選項名稱統一，並把 JSON／HTML 等技術字眼換成任務語言。

驗收證據：敘事流感第 1 頁顯示傳染／代謝／神經，第 2 頁顯示心血管／呼吸／消化泌尿，網址同步 `editorialPage=2`；全文稿列出六類、描述與代碼。375–390px 下文件寬度不溢出，放大畫布內可左右捲動；Escape／關閉會回復焦點，瀏覽器錯誤為 0。

目前介面 UAT 三位角色皆達 9/10 以上。臨床醫師對手機預覽子項評 8.5/10，因 1:1 方形畫布需左右滑動；完整文案可在同頁展開。此原型只用靜態素材比較 UI，實際產圖時間、重跑穩定性與範例內容臨床正確性仍為 NOT_RUN，並未據此選定正式工作流。

最終驗證：`npm test` 215/215、`npm run test:e2e` 15/15、`npm run integrity` 0 errors、`npm run images:inventory` 通過；`git diff --check` 與原型 JS／Playwright spec 語法檢查通過。

## 第一輪觀察

- 直接產圖有很高的即時完成度，但模型將指定的「少於一分鐘」改寫成「小於一分鐘」，標點與代碼分組也會自行處理。
- 直接產出的正方形內容放入固定頁首頁尾後，必須在裁切與左右留白間選擇；原型選擇完整縮放，不裁切資訊。
- 模板合成的文字與頁碼完全可控，也能保持固定框架；代價是需要預先建立資料契約與版型。
- 敘事模板最多承載三個重點；流感六分類必須拆成兩頁，不能靜默遺漏或縮字硬塞。
- 模組模板能容納六分類，但資訊密度較高，仍需以實際診間距離與 Instagram 顯示尺寸驗證字級下限。

## 原型資產

所有圖片由內建 image generation 工具產生，未使用 SVG 或 CLI/API fallback：

```text
images/prototype-education/
├── menieres-direct.webp
├── menieres-illustration.webp
├── oral-direct.webp
├── oral-illustration.webp
├── influenza-direct.webp
└── influenza-illustration.webp
```

完整 prompt 見 [education-page-workflow-prompts.md](./education-page-workflow-prompts.md)。視覺檢查 contact sheet 位於 `test-results/education-prototype/contact-sheet.png`，屬於可重建的測試輸出。

## 非目標

- 不寫入 `procedures/*.json` 或 `images/{procedure}/`。
- 不取代既有 admin 編輯器。
- 不自動發布或遷移現有圖片。
- 不以這份 throwaway CSS 作為 production design system。
