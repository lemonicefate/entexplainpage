# Issue tracker: GitHub

本 repository 的 issues 與 PRDs 存放在 GitHub Issues，工程 skills 使用 `gh` CLI 讀寫，repository 由目前 git remote 推導。

## Conventions

- 建立、讀取、留言、加減 labels 與關閉 issue，使用對應的 `gh issue` 指令。
- 發布 ticket 時依 dependency order 建立，並套用 `ready-for-agent` label。
- Blocking 優先使用 GitHub native issue dependencies；若 repository 或 CLI 尚不支援，回退為 issue body 的 `Blocked by: #<number>`。
- 只有所有 blocker 都已關閉的 ticket 才能標為 `ready-for-agent`。
- GitHub issue 與 PR 共用編號；遇到裸編號時先判斷其實際類型。

## Pull requests as a triage surface

**PRs as a request surface: no.** 外部 PR 不自動進入 issue triage queue；明確指定的 PR 仍可個別處理。

## Publishing

當 skill 要求「publish to the issue tracker」時，建立 GitHub issue。當 skill 要求讀取 ticket 時，讀取完整 issue body、comments 與 labels。
