# Requirements

## Functional requirements

### R1. Directory inspection

- Vault rootまたはVault相対pathを指定して、配下のフォルダ、Markdown、対応添付のmetadataを返せること。
- 既定depthは1、最大depthは3、1回の最大entry数は200とする。超過時は`truncated: true`と`next_after`を返し、同じpath/depthへ`after`を渡して続行できること。
- ページングはsnapshotを保持しない。同一一覧の取得中に項目が追加・削除されると重複または取漏れが起こり得るため、厳密な棚卸しを行う呼出し元は先頭から再取得すること。
- 本文は返さないこと。`.tsuzune`、`.trash`、dot directory、利用者の除外設定は通常結果へ出さないこと。
- フォルダは直下のfolder/note/attachment件数を返し、ファイルはtype、size、modified timeを返すこと。

### R2. Directory creation

- 存在する親の直下に一つだけ作ること。親階層を暗黙作成しないこと。
- Vault外、内部管理領域、Windows予約名、末尾空白・ドット、symlink traversalを拒否すること。
- 同名項目が存在する場合は失敗し、上書きや暗黙連番をしないこと。

### R3. Unified move behavior

- M1は単一Markdown、M2は単一Markdownまたはフォルダを対象にすること。フォルダの子として添付も一緒に移動できること。
- destinationは完全なVault相対pathとし、同一親なら改名、別親なら移動として扱うこと。destination parentは既存であること。
- AIは衝突時に失敗し、上書き、merge、暗黙連番をしないこと。
- UIの単一ノート・添付移動は既存の自動採番を維持する。UIのフォルダ移動・全renameは衝突時に失敗すること。
- Vault root、内部管理領域、symlink、自分の子孫への移動を拒否すること。

### R4. Preflight and stale rejection

- apply前にpreflightを必須とし、source type、root mapping、件数、衝突、リンク影響、保護領域、Drive追跡済みmove件数、未追跡で次回upload対象となる件数を返すこと。
- mappingが多い場合は全件をtool responseへ展開せず、最大50例と`mapping_truncated`を返すこと。
- preflightはopaque fingerprintを返すこと。apply時にsource tree、destination、保護条件、または移動方針が変化していれば、何も移動せず再preflightを要求すること。
- rename直後かつDrive台帳更新前にdestination treeを同じmanifestで再検証し、別プロセスのMCPや外部変更が割り込んでいればrenameを戻して失敗すること。

### R5. Drive consistency

- フォルダ移動では、配下のDrive追跡対象Markdownを一つの操作として台帳へ反映すること。
- 既にA→Bが未同期で、その後B→Cへ移動した場合、結果はA→Cとすること。
- 一部だけ台帳へ保存した状態を成功扱いにしないこと。
- Drive未連携のVaultでは台帳更新をskipし、ネットワークやGoogle認証をlocal moveの前提にしないこと。Drive連携済みでlocal台帳が読めない場合だけfail closedとすること。
- 成功後のDrive previewで追跡済みノートをmoveとして解釈し、同じDrive file IDを維持できること。
- Drive未追跡のMarkdownには`pendingMove`を新設せず、次回previewで新pathの`upload/new_local`として扱うこと。台帳上の対応がない旧remote fileを同一ファイルと推測しないこと。

### R6. Link and app-state impact

- path-qualified Wiki linkが未解決または曖昧になる参照元件数と最大3例をpreflightへ出すこと。
- リンク本文や旧path aliasを自動生成しないこと。
- 旧path解決を必須とする専門的な物理移行は、`move_entry`外でalias mappingを明示準備・検証できなければ停止すること。
- 成功時は選択、開いているタブ、添付表示、template folder設定、作成日時sidecarを新pathへ追随させること。

### R7. Protection semantics

- `50_履歴/**`はAIとアプリUIの双方で移動元、移動先、改名、trashを拒否すること。閲覧は許可すること。
- `40_情報源/**`は人間UIで再分類できること。別ゲート通過後のAIは、移動先が`40_情報源/**`のmoveだけを許可し、移動元が同領域の場合は移動先も同領域内に限ること。領域外への持出しとAI本文編集・作成は拒否し、ゲート前には公開しないこと。
- フォルダ自体を一般的な権限境界にせず、任意のAI不変設定を追加しないこと。
- Explorer等の外部操作は保証外であることを運用資料へ明記すること。

### R8. Audit, rollback, and crash recovery

- 成功したAI moveはreason、source refs、fingerprint、root mapping、件数、時刻を`50_履歴/AI更新`へ一操作一件で記録すること。本文複製や秘密情報を含めないこと。
- 通常例外ではfilesystem、Drive台帳、AI監査を操作前へ戻して失敗を返すこと。
- プロセスクラッシュ後は、未完了moveを起動時に検出し、安全に自動rollbackできる状態だけ戻すこと。journalのflushにより電源断耐性も高めるが、filesystem全体の完全な電源断transactionは保証しない。両path存在、両path不在、衝突等で判断不能なら新しいmoveを禁止して`RECOVERY_REQUIRED`を表示し、推測で続行しないこと。
- 失敗した試行の監査note作成は要求しない。呼出し結果とjournal recoveryで扱い、失敗監査のための別ログ基盤は作らないこと。

### R9. AI-assisted organization plan

- 「全部いい感じに整理して」という依頼では、AIは`list_directory`、`search`、必要な`fetch`を使い、まず変更を伴わない整理案を作ること。
- 整理案は、作成予定フォルダ、各ノートの移動元・先、短い理由、確信度、対象外とその理由を含むこと。`40_情報源`、`50_履歴`、内部管理領域は既存保護を優先すること。
- 利用者が整理案全体を明示承認するまで、フォルダ作成や移動を実行しないこと。
- 承認後は既存`create_directory`、`preflight_move_entry`、`move_entry`を使い、一件ごとに最新状態を再検査すること。途中失敗時は後続を停止し、完了・未完了・失敗理由を残して再開できること。
- 整理全体を一つのatomic transactionとは主張しないこと。各移動の安全性と監査はM1契約で保証し、全体は再開可能な逐次処理として扱うこと。
- 初期実装では専用bulk organizer tool、分類モデル、rule engine、常駐自動整理を追加しないこと。既存ツールの組合せで不足が実測された場合だけ製品機能化すること。

## Tool surface

### `list_directory`

- input: `path?`, `depth?`, `after?`
- output: normalized path、metadata children、直下件数、`truncated`、`next_after?`
- read-only。本文を返さない。

### `create_directory`

- 既存親直下に一つだけ作る書込み操作。

### `preflight_move_entry`

- input: `source`, `destination`
- output: summary manifest、fingerprint、link/Drive/protection impact
- read-only annotationを付け、TSUZUNE本体が起動していなければ失敗する。

### `move_entry`

- input: `source`, `destination`, `expected_fingerprint`, `reason`, `source_refs`
- pathを変える書込み・破壊的操作としてapproval対象にする。
- TSUZUNE本体が起動していなければ失敗し、direct fallbackしない。
- rename専用、folder専用toolは作らない。M3初期段階ではbulk organizer toolも作らず、AIが既存toolを組み合わせる。

## Acceptance criteria

1. `list_directory`がdepth/entry上限、除外設定、本文非返却を守り、切詰め時に`next_after`から残りを取得できる。
2. preflight後にMarkdown本文、path、添付metadata、destination、保護条件のいずれかが変わるとapply前に拒否する。
3. 3階層、複数Markdown、添付を含むフォルダが全体成功し、旧rootが消え、作成日時とアプリ状態が追随する。
4. A→Bが未同期の状態でB→Cを含むフォルダ移動を行うと、追跡済みノートのDrive previewはA→Cのmoveになりfile IDを維持する。未追跡ノートは新pathの`upload/new_local`となり、旧remoteとの同一性を推測しない。
5. filesystem、Drive台帳、AI監査の各failpointで、通常例外後のtreeと台帳が操作前と一致する。
6. 各処理境界でプロセス終了を模擬し、次回起動で自動rollbackまたは`RECOVERY_REQUIRED`になる。曖昧状態で新しいmoveを許可しない。
7. 衝突、case-only衝突、Vault外、内部領域、symlink、自分の子孫を拒否する。
8. `50_履歴`をAIとUI双方で保護する。`40_情報源`は人間再分類を維持し、別ゲート後もAIは領域内へのmoveだけ、領域内からは領域内moveだけを許可し、本文編集・作成と領域外持出しを拒否する。
9. MCPとUIの同一入力が同じpreflight summaryとapply結果を得る。MCP direct server単独では移動できない。
10. 「全部いい感じに整理して」で、AIが変更前の整理案を提示し、未承認では書込みゼロ、承認後は一件ずつfresh preflightして適用し、途中失敗時に進捗を失わず停止できる。

## Verification minimum

- `npm run typecheck`
- 対象unit/integration testsと各failpoint test
- MCP tool annotation、tool count、起動アプリ不在時のsmoke
- packaged/installed isolated smoke
- shipped codeなら`npm run production:update`
- `git diff --check`とPonytail review
