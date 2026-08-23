# Implementation brief

## Minimal architecture

新しい汎用frameworkは作らない。`src/main/entry-move.ts`に、pureなplan生成と一件ずつ直列実行するmove coordinatorを置く。既存`VaultService`、`DriveSyncService`、監査note作成を呼び、UI IPCとMCP loopbackの双方がこのcoordinatorを使う。

既存`mcp-drive-sync-bridge.ts`は移動endpointも扱うapp bridgeへ一般化する。capability file、127.0.0.1限定、bearer token、request size上限は再利用する。MCP側はpreflight/applyをこのbridgeへ委譲し、アプリ不在時は明示失敗する。

通常IPC queueとGoogle queueは現状別々なので、move入口は`runInOrder(() => runGoogleInOrder(() => coordinator.apply()))`の順で取得する。coordinatorは内部から`DriveSyncService`を直接呼び、Google IPCを再入しない。Google queue側から通常queueを待つ逆順経路を作らない。既存`drive:pairVault`を実装形の先例とし、Drive preview/applyとmove transactionが相互に割り込まないこと、逆順待ちがないことを一件のordering testで固定する。

## Plan and fingerprint

fresh scanから正規化・sort済みmanifestを作る。

- Markdown: pathと既存content revision。
- 添付: path、size、mtime。
- directory: path。
- 共通: source/destination root、destination parent、保護方針version、collision policy。

canonical JSONのSHA-256をopaque fingerprintとする。`rootRevision`はVault切替検知にだけ使い、内容変更検知の代用にしない。

添付について、同じsizeかつmtimeを復元したbyte変更は検知できない。大容量binaryの全hashを避ける現実的な残余リスクとして明記する。実測で問題化した場合だけ、小容量添付のhash閾値を追加する。

## Apply sequence

共有queue内で以下を行う。

1. fresh preflightを再実行し、expected fingerprint、destination、保護条件、衝突を照合する。
2. Drive `pendingMoves`の次状態と、AI監査noteの内容・未使用pathをメモリ上で準備する。
3. `.tsuzune/pending-entry-move.json`の一時ファイルを`wx`で開き、write、`FileHandle.sync()`、close、renameの順で保存する。
4. filesystemをsourceからdestinationへrenameする。
5. destination側のtreeをmanifestで再検証する。preflight直後に別プロセスがsourceを変更していれば、この時点でrenameを戻す。
6. Drive台帳を一回だけatomic writeする。
7. AI操作なら監査noteを一件作る。
8. creation-time sidecarとアプリ状態を追随させ、journalを削除して成功を返す。

監査は最後にする。監査を先に作ると後続失敗時に虚偽の成功履歴が残り、`50_履歴`保護と衝突するためである。

## Drive bulk normalization

`recordLocalMoves(mappings)`を追加し、一回のledger read/writeで処理する。各Markdown mappingを順に、既存`pendingMoves`でtargetがold pathのoriginal pathを探し、original→newへ畳み込む。A→B pending後のB→CはA→Cになる。

同一originalの重複、複数originalの同一target収束、Windows case-insensitive collisionはwrite前に拒否する。trackedでないMarkdownは台帳へ新規moveを作らない。

Drive未連携Vaultでは台帳処理をskipする。Drive連携済みならネットワーク接続やGoogle再認証はmove時に要求せず、local ledgerだけを更新する。連携済みledgerが破損・読取不能ならfile ID追跡を守るためfail closedとする。

未追跡Markdownは`pendingMoves`へ追加せず、次回previewでは新pathの`upload/new_local`になる。台帳に対応関係がない旧remote fileが残っていても同一ファイルとは推測しない。preflightは追跡済みmove件数と未追跡upload件数を分けて返す。

## Rollback and journal recovery

通常例外では逆順に戻す。

- 監査失敗: Drive台帳を保存済みsnapshotへ戻し、destinationをsourceへrenameする。
- 台帳失敗: destinationをsourceへrenameする。
- rollback自体が失敗: journalを残し`RECOVERY_REQUIRED`を返す。

journalは同時に一件だけとし、本文、token、秘密情報を含めない。operation id、actor、source/destination、manifest summary、fingerprint、操作前pendingMoves、予定監査pathを持つ。汎用event logやDBにはしない。

このflushはprocess crash後のjournal残存を強めるが、Windows上のdirectory entryまで含む普遍的なpower-loss transactionは主張しない。自動回復の必須対象はprocess crashとし、電源断はbest effort、判断不能状態は`RECOVERY_REQUIRED`で止める。

起動時は実体、台帳、actor別の監査有無を照合し、次だけ自動判断する。

- sourceあり・destinationなし・台帳が操作前・監査なし: 未適用としてjournalを削除する。
- sourceなし・destinationあり・台帳が操作後・AIなら監査あり: commit済みと判断し、creation-time sidecar等のidempotentな後処理を再実行してjournalを削除する。人間操作は監査不要。
- sourceなし・destinationあり・監査未作成かつ監査がまだ成立し得ない段階: 台帳を操作前へ戻し、destination→sourceを試す。
- sourceありでも台帳が操作後、監査がある、両path存在、両path不在、内容不一致のいずれか: `RECOVERY_REQUIRED`で停止する。

journalの有無だけで成功・失敗を決めず、想定した三者の組合せだけを自動処理する。

## Collision policy

- AI: 常に完全destination指定、全衝突失敗。
- UI rename: 全衝突失敗。
- UI single note/attachment move: destination未指定時だけ既存自動採番。
- UI folder move: destination未指定でも同名folderがあれば失敗。暗黙mergeも採番も行わない。

UIが採番した最終destinationを確定してからmanifest/fingerprintを作り、preflight表示とapply結果を一致させる。

## Protection implementation

既存path-based protectionを共通pure functionへ寄せ、UIとMCPのplan生成で同じ判定を使う。`50_履歴`はsource/destinationの双方を拒否する。`40_情報源`の別ゲート後はmove専用の例外とし、destinationが同領域内なら許可、sourceが同領域内ならdestinationも同領域内の時だけ許可する。領域外持出しと本文編集・作成は従来どおり拒否する。外部Explorerで履歴を移動するとpath roleを失うため、アプリ外操作は保証外と運用資料へ記載する。persistent ID、database、任意のフォルダ権限UIは今回追加しない。

## Tool migration

- `list_directory`: 既存VaultSnapshotを正規化path順に絞り込み、最大200件と`after`/`next_after`で軽量ページングする。snapshot cursorは持たず、同時変更時の重複・取漏れと厳密な棚卸し時の先頭からの再取得をtool説明へ明記する。別の再帰walkerやcursor保存領域を作らない。
- `preflight_move_entry`: read-only/non-destructive annotation。
- `move_entry`: write approval、destructive annotation。
- 既存`move_note`: 同releaseで削除。direct server利用者向け互換分岐は残さない。
- 2026-08-21以降の`40_情報源`移動許可ゲートは対象を`move_entry`へ移し、上記のsource/destination非対称規則を検証する。任意のフォルダ権限UIへ一般化しない。
- freebuff tool set、server description、`scripts/check-mcp.mjs`、tool count testを同時更新する。

## Path aliases and specialized migration

通常の`move_entry`はaliasを自動生成しない。`40_情報源`の物理サブフォルダ化のようにimmutableな旧path参照を残す専門移行は、69側の旧path→新path mapping、collision/chain検証、適用前image、rollback、適用後read-backを別の承認済み手順として用意する。alias適用経路が検証できない、またはmove失敗時にalias側を戻せない場合は物理整理を開始しない。

## Test slices

1. plan pure tests: path normalization、counts、link impact、fingerprint、protection、collision policy。
2. Drive tests: folder mappings、A→B→C chain、duplicate target、single atomic write failpoint。
3. coordinator integration: filesystem/ledger/audit各failpointと逆順rollback。
4. queue ordering: 通常queue→Google queueの順序、Google queueからの逆待ち不在、preview/applyとの非割込み。
5. crash matrix: test-onlyのafter-stage hookを持つNode child processを使い、journal作成後、rename後、ledger後、audit後にprocess exitさせる。parent processが同じfixtureでrecoveryを起動し、自動rollbackまたは`RECOVERY_REQUIRED`を検証する。Promise rejectionだけをcrash証明にせず、Electron本体もkillしない。
6. route parity: UI IPCとMCP bridgeが同じplan/resultになり、app不在MCPはfail closed。
7. packaged isolated smoke後、production update gateを実行する。

## M3最小実装

製品コードを追加せず、Codex／Freebuffが既存`list_directory`、`search`、`fetch`で整理案を作り、人間の一括承認後に`create_directory`、`preflight_move_entry`、`move_entry`を逐次実行する。進捗と結果は通常のTSUZUNEノートへ記録し、失敗時は後続を止めて再開する。

専用bulk endpointやVault全体rollbackを先に作らない。既存の一件単位journalと監査で安全性を保ち、実運用でtool round-trip、承認表示、再開操作が明確な摩擦になった場合だけbatch plan/applyを製品機能へ昇格する。

## Explicit stop rule

M0〜M2と上記acceptance、M3の既存tool合成運用が成立すれば完了とする。trash復元、添付単体AI移動、専用bulk organizer、任意AI不変設定、汎用transaction基盤は追加しない。
