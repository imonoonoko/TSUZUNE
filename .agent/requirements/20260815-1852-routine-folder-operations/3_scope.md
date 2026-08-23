# Scope

## M0 — structure read/create

- 本文を返さない制限付き`list_directory`を追加する。
- 既存`create_directory`を、既存親直下に一つだけ作る常用ツールとして公開する。
- アプリのフォルダ作成を`window.prompt`からツリー内inline入力へ寄せる。

M0は移動transactionに依存せず、最初に出せる。

## M1 — single Markdown move

- 単一Markdownノートを対象に`preflight_move_entry`と`move_entry`を追加する。
- UIとMCPを起動中アプリの同一move coordinatorへ載せる。
- filesystem、Drive台帳、AI成功監査を直列化し、例外rollbackと一件のoperation journalを実装する。
- 既存MCP `move_note`は同じreleaseで廃止する。直接実行fallbackや互換aliasは残さない。
- `50_履歴/**`の移動・改名・ゴミ箱をアプリUIでも禁止する。

## M2 — folder move

- M1の実行経路を、配下Markdown、対応添付、サブフォルダを一つのmanifestとして扱うフォルダ移動へ拡張する。
- 配下MarkdownのDrive移動を一括記録し、既存の連鎖moveを正規化する。
- UIのfolder rename、Move dialog、drag-and-dropを同じpreflight/applyへ統合する。
- AIへフォルダ移動を公開するのはM2のacceptance完了後とする。

## M3 — AI-assisted organization

- 利用者の「全部いい感じに整理して」を、まずAIがVaultを調査して整理案を作り、人間の一括承認後に既存`create_directory`／`preflight_move_entry`／`move_entry`を順番に使う運用として成立させる。
- 整理案には作成フォルダ、移動元・先、理由、確信度、対象外を含める。承認前はVaultを変更しない。
- 適用は一件ごとにfresh preflightし、失敗時は停止する。完了済み項目を巻き戻す巨大transactionは作らず、進捗を残して再開可能にする。
- 初期段階では専用`organize_vault` tool、自動分類器、rule engineを作らず、既存MCP操作をAIが組み合わせる。

## M4 — observed recovery needs

- `.trash`からの一件復元は、実際の常用摩擦とDrive上の削除・復元契約を別設計してから追加する。
- Move dialog検索、AI添付単体移動、専用の複数項目preview/applyは、M3運用で必要性が観測された後に判断する。

## Explicitly deferred

- AIによるtrash、完全削除、空フォルダ自動削除。
- 複数階層を一回で暗黙作成する`create_directory`。
- AI操作の衝突時連番、merge、上書き。UIの単一ノート・添付移動だけは既存の自動採番を維持する。
- UIのフォルダ移動での自動採番。フォルダ衝突は失敗させる。
- Wikiリンク本文の自動一括書換え、旧path alias。
- バックグラウンドでの無承認自動移動、rule builder、smart folder。

## Release boundary

- この成果物は設計のみで、製品コード、本番Vaultの物理整理、production updateを行わない。
- `40_情報源`のAI移動許可は既存計画どおり2026-08-21以降の別ゲートで扱い、その対象ツールを旧`move_note`から`move_entry`へ移す。許可後も、移動先が`40_情報源/**`ならmoveだけ許可し、移動元が`40_情報源/**`の場合は移動先も同領域内に限る。領域外への持出しと本文編集・作成は許可しない。
- フォルダごとの任意なAI不変設定や権限UIは追加しない。
- `40_情報源`の物理整理は通常の`move_entry`とは別に、旧pathから新pathへのalias mappingを明示作成・検証できる移行手順が成立するまで実行しない。通常の`move_entry`はaliasを生成しない。
- destination parent既存必須は、現行MCP `move_note`の親暗黙作成からの意図的変更である。
