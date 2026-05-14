# lipid 計算機定位為健保給付查表，而非臨床風險評分

`lipid` 計算機原本以一個自創的 `rf*3.2+...` 公式估算「10 年 ASCVD 風險 %」當作主結果。該公式無實證依據（ROADMAP / TODOS.md 已標記為「湊出來的、刻意不寫測試」）。我們決定**移除風險分數**，把計算機重新定位為健保署降血脂藥物給付規定（文件 031170）的查表工具：輸入病人類別與血脂值，逐條核對 statin / fibrate 的健保給付資格與目標值。

## Considered Options

- **換成有實證的 ASCVD 演算法（如 Pooled Cohort Equations）** — 被否決。它與健保查表是兩套獨立邏輯、PR 會膨脹，且台灣健保給付判定本來就不看 % 風險分數，醫師真正需要的是「這支藥健保會不會給付」。
- **保留假公式並標註「僅供參考」** — 被否決。在官方查表結果旁放一個無依據的數字，仍會誤導。

## Consequences

- 計算機不再輸出任何風險百分比；headline 改為「符合 / 不符合健保給付」。
- 給付規則邏輯抽成純函式 `lipidCoverage(state)`（掛 `window.__lipidCoverage`），並以 `tests/unit/calc/lipid.test.js` 完整矩陣 golden-file 鎖死——健保規則屬「權威抄寫型」，規範更新時測試會逼開發者同步。
- 若未來健保給付規定表改版，唯一需要同步的地方是 `lipidCoverage()` 與其測試矩陣，以及 CONTEXT.md 的病人類別表。
