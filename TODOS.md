# TODOS

## TODO: AbortController 用於圖片預載
**Priority:** Medium
**What:** 醫師點錯手術立即返回再點另一個時，前一個的預載請求應該被取消，不跟新的搶頻寬。用 AbortController 管理 fetch/image preload 請求。
**Why:** 避免診間網路較慢時，舊的預載影響新手術的載入速��。
**Context:** app.js 中進入投影片模式時會預載所有步驟圖片。如果醫師快速切換手術，多組預載會同時執行。在 Wi-Fi 不穩的診間，這會導致新手術的圖片載入延遲。
**Depends on:** 核心投影片渲染功能完成後。

## TODO: Keyboard navigation + ARIA 無障礙支援
**Priority:** Medium
**What:** 加入鍵盤左右箭頭翻頁、focus management、aria-live 區域、role 屬性。
**Why:** 台灣醫療機構有無障礙法規要求。部分醫師用桌機 + 鍵盤操作，鍵盤翻頁比用滑鼠點箭頭更快。
**Context:** 目前設計只有 touch gesture + 箭頭按鈕。需要加入：keydown event listener（左右箭頭）、aria-live="polite" 在步驟變更時通知 screen reader、focus trap 在投影片模式中、role="region" 標記投影片區域。注意：/plan-design-review 已在設計文件中加入了詳細的 ARIA 規格，實作時參考設計文件。
**Depends on:** 核心投影片渲染功能完成後。

## TODO: 建立正式 DESIGN.md
**Priority:** Low
**What:** 將設計文件中的視覺規格（色彩系統、字型、間距 scale、響應式斷點）提取成獨立的 DESIGN.md。
**Why:** 當專案成長到 10+ 個手術或需要其他人貢獻 UI 時，統一的設計語言文件會減少不一致。
**Context:** 目前設計規格已寫在 office-hours design doc 中的「視覺設計規格」段落。如果專案規模保持在 5 個手術以內，這個 TODO 可以跳過。
**Depends on:** 初版上線後。
