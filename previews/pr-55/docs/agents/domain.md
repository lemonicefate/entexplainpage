# Domain Docs

本 repository 採 single-context domain documentation。

## Before exploring

- 先讀根目錄 `CONTEXT.md`，並使用其中定義的領域語彙。
- 讀取 `docs/adr/` 中與工作範圍相關的決策。
- 文件不存在時直接繼續，不預先建立空白領域文件。

## Consumer rules

- Issue title、設計與測試名稱應沿用 `CONTEXT.md` 的用語，避免使用被明確排除的同義詞。
- 若提案與既有 ADR 衝突，必須明確指出並要求重新決策，不得靜默覆寫。
- 新領域概念確有必要時，再透過 domain-modeling 流程補充語彙或 ADR。
