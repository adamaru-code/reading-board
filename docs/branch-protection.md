# main ブランチ保護 — 要件定義・設計

`main` ブランチを GitHub 側で保護し、[CLAUDE.md](../CLAUDE.md) §1 で禁止している行為を
**技術的に強制**するための要件・設計・運用をまとめる。

---

## 1. 目的・背景

CLAUDE.md は `main` への直接コミット / 直接 push / force push / 削除 / PR なしマージ を NG 行為と定めている。
ただしルールが文書上の約束にとどまると、管理者権限を持つ操作者（人間・Claude を問わず）が
うっかり直接 push できてしまう。本保護はこれを GitHub の Repository Ruleset で機械的に防ぐ。

---

## 2. 要件

| ID | 要件 | 根拠（CLAUDE.md §1） |
|---|---|---|
| R1 | `main` への直接 push 禁止（変更は PR 経由を必須化） | 「main への直接コミット・直接 push」禁止 |
| R2 | `main` への force push 禁止 | 「main への force push」禁止 |
| R3 | `main` の削除禁止 | 「main の削除」禁止 |
| R4 | マージには PR を必須。ただし承認 0 でセルフマージ可 | 「レビュー承認は不要（セルフマージ可）」 |
| R5 | 上記を管理者（ADMIN）にも強制する | 「Claude が直接 push しない」を機械的に担保 |

feature ブランチのマージ後削除（`--delete-branch`）は `main` を対象にしないため、本保護の影響を受けない。

---

## 3. 設計・実装

GitHub の **Repository Ruleset** で実装する（従来の branch protection ではなく現行推奨方式）。

### 構成

| 項目 | 値 |
|---|---|
| Ruleset 名 | `protect-main` |
| target | `branch` |
| 対象 ref | `~DEFAULT_BRANCH`（= `main`） |
| enforcement | `active` |
| bypass_actors | （空）= 管理者を含む全員に強制（R5） |

### ルール ↔ 要件の対応

| Ruleset ルール | 対応要件 |
|---|---|
| `deletion` | R3 |
| `non_fast_forward` | R2 |
| `pull_request`（`required_approving_review_count: 0`） | R1・R4 |

### 再現手順

`bypass_actors` を空にすることで、管理者もバイパス不可（`current_user_can_bypass: "never"`）になる。

```bash
# ruleset.json を用意して POST
gh api --method POST repos/adamaru-code/reading-board/rulesets \
  --input ruleset.json

# 確認
gh api repos/adamaru-code/reading-board/rulesets
```

`ruleset.json` の内容:

```json
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash", "merge", "rebase"]
      }
    }
  ],
  "bypass_actors": []
}
```

---

## 4. 運用

- 通常の変更は **Issue → Branch → PR → セルフマージ → Branch 削除**（[CLAUDE.md](../CLAUDE.md) §1）で行う。
- R5 により、管理者であっても `main` への直接 push・force push はできない。
- **緊急時に一時解除する場合**は enforcement を落とし、作業後に必ず戻す:

```bash
# 一時解除（disabled）
gh api --method PUT repos/adamaru-code/reading-board/rulesets/<ID> \
  -f enforcement=disabled
# …作業…
# 復帰（active）
gh api --method PUT repos/adamaru-code/reading-board/rulesets/<ID> \
  -f enforcement=active
```

管理コンソール: `https://github.com/adamaru-code/reading-board/rules`（Settings → Rules → Rulesets）。

---

## 5. 検証

| 観点 | 確認方法 | 期待結果 |
|---|---|---|
| 有効化 | `gh api repos/.../rulesets/<ID>` | `enforcement: "active"` |
| 管理者強制（R5） | 同上のレスポンス | `current_user_can_bypass: "never"` |
| 直接 push 拒否（R1・R2） | `main` へ直接 push を試行 | リモートが拒否（`protected branch`） |
| PR マージ可（R4） | 承認 0 の PR をセルフマージ | マージ成功 |
