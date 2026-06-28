---
name: implement
description: 実装タスクでは必ず使用する。設計→承認→実装→レビュー→必要なら修正を自動で進める。
---

コードは自分で書かず、サブエージェントのみを使用してください。

## タスク

$ARGUMENTS

## フロー

### Phase 0: 設計
- `designer` を実行
- ユーザーの指示と、存在すれば `CLAUDE.md` を渡す
- 設計方針をそのまま提示し、承認を得る
- 承認されるまで次へ進まない

### Phase 1: 実装
- `implementer` を実行
- 設計方針を渡す
- スコープ外の変更は禁止
- 完了後、変更ファイル一覧を受け取る

### Phase 2: レビュー（codex-review → validator 精査）
1. `mcp__codex-review__review_current_diff` を実行する（旧 `reviewer` サブエージェントは使わない）
   - `repo_path`: リポジトリのルート（このプロジェクトでは `/Users/daikisaito/dev/recipe_mng`）
   - `doc_paths`: 正確性レビューのため関連ドキュメントを渡す（例 `["CLAUDE.md", "docs/architecture.md", "docs/database.md", "docs/project.md"]`）
   - Codex が自分で git diff を取得するため、Claude 側で diff 本文を渡さない（トークン節約）
   - ユーザーから「プロジェクト全体をレビュー」等の明確な指示があるときのみ `mcp__codex-review__review_whole_project` を使う
2. `reviewer-validator` を実行し、codex-review の指摘を精査させる（維持・降格・却下／重要度調整）
   - 入力: codex-review の出力（指摘一覧）＋変更ファイル一覧・実装概要
   - validator が必要に応じて実ファイルを確認して妥当性を判断する
3. validator 精査後の結果（Critical/Warning/Suggestion）を Phase 3 の判定に使う
- 旧 `reviewer` / `reviewer-*`（5専門レビュアー）は休眠（残置）。レビュー本体は codex-review に置換
- 必要なら Warning / Suggestion を `docs/review-notes.md` に追記してよい（任意・git 管理対象外）

### Phase 3: 判定
- Critical が0件なら完了
- 1件以上なら Phase4

### Phase 4: 修正
- `implementer` に Critical のみ渡して修正
- 修正後は再レビュー（再度 `mcp__codex-review__review_current_diff`）
- 最大2ループまで

### Phase 5: 完了

```
【実装完了 ✅】
- ループ回数:
- 変更ファイル:
- 最終レビュー:
- 概要:
- 残Warning:
```

## ルール

- commit / push は行わない
- Warning はループ条件にしない
- Phase0以外は自律実行