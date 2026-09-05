# TSUZUNE AI文脈エンジン統合設計 v1

## 1. 結論

人間は分類・タグ・保存先を決めず、`01_受信箱`へ書く。AIは決まった時刻に受信箱だけを読み、安全に確定できる一件を既存の正本位置へ移し、曖昧・競合・不可逆な候補だけを人間へ返す。

この仕組みは四層に分ける。

| 層 | owner | 責務 | 正しさの根拠 |
|---|---|---|---|
| TSUZUNE | Markdown Vault | 現在の知識、Inbox状態、MOC、保護境界 | file path、本文、frontmatter、Wiki link |
| MCP | TSUZUNE local server / running app | bounded read、revision付きwrite、preflight、move、readback | revision、fingerprint、collision check、move journal |
| Hooks | TSUZUNE main process | capture・filesystem・applyの事実通知 | watcher event。正本や実行命令にはしない |
| Schedule / AI | Codex local recurring task | scan、意味判断、安全gate、例外報告 | 固定prompt、毎回の全Inbox scan、MCP結果 |

TSUZUNEへLLM、API key、独自DB、履歴store、常駐organizerを内蔵しない。AIと時刻管理は外部host、知識と安全な操作はTSUZUNEに置く。

```text
Human / external capture
        |
        v
  01_受信箱/*.md  ---- fact-only Hook ----> transient inbox-dirty signal
        ^                                      |
        |                                      | advisory only
        |                                      v
        +---- full scan <---- daily Codex heartbeat / manual run
                                 |
                                 v
                    list -> fetch -> bounded context
                                 |
                        deterministic safety gate
                          /                 \
                 safe one-note move      exception
                    + readback        leave in Inbox
                          |          + needs_review state
                          v
               10 / 20 / 30 / 40
```

## 2. 動画とゲームブックから採用する核

- Inboxは分類済みノートの置場ではなく、判断を後回しにする入口である。
- AIは定期的にInboxを読み、既存の文脈へ統合する。
- 大きな万能Contextを毎回読まず、小さな入口と必要なノートだけを読む。
- Rawと原典は失わず、必要なら派生知識を別に作る。
- 日次はroutine整理、週次は構造の点検に分ける。
- 初期設定と不可逆操作は人間が確認し、routineで安全な処理は自動化する。

TSUZUNEでは動画のフォルダ名を複製しない。`01_受信箱`、`10_プロジェクト`、`20_分野`、`30_知識`、`40_情報源`、既存MOCが同じ責務を既に持つ。Processed、Archive、History、巨大なMyContextは作らない。

## 3. Scope

### 自動化する範囲

- `01_受信箱`直下のeligibleなMarkdownだけを最大10件ずつ処理する。
- 受信箱ノート一件を、同じ本文・同じfilenameのまま既存の`10`、`20`、`30`、`40`の一箇所へ移す。
- move後にdestinationを再取得し、本文とrevisionを確認する。
- 後続sliceで、根拠が一意な時だけ移動後ノート自身へ明示Wiki linkを一件追加する。
- current project noteやMOCの更新は、既存入口から重要ノートへ到達できない時だけ別のrevision付き操作として行う。

### 自動化しない範囲

- 全Vault ingestion、全件再分類、一括書換え。
- merge、delete、trash、rename、衝突時の上書き。
- 複数責務を含むノートのsplit、矛盾の解消、事実の採否。
- `knowledge.md`、legacy `50_履歴`、`.tsuzune`、`.trash`の整理。
- `40_情報源`本文のAI更新、巨大Rawのmodel送信。
- Graph外観、リンク数、ノート数を目的化すること。

## 4. TSUZUNE information model

### 4.1 物理位置を現在状態にする

| 位置 | 意味 | AIのroutine action |
|---|---|---|
| `01_受信箱` | 未確定、または人間判断待ち | eligibleな一件を評価 |
| `10_プロジェクト` | 終了条件のある現在の仕事 | safe move。後続sliceでcurrent noteへ接続 |
| `20_分野` | 継続責任、本人・生活・環境文脈 | safe move。既存分野MOCを再利用 |
| `30_知識` | 再利用できる主張・原則・手順 | safe move。必要時だけ一意な関連linkを追加 |
| `40_情報源` | 原典、会話原文、取得物、証拠、複合Raw | 本文を変えず領域内へmove。派生は別note |

成功したノートへ`organized: true`や処理日時を残さない。受信箱から最終位置へ移った事実そのものが現在状態であり、履歴を別に作らない。

### 4.2 Inboxの最小frontmatter

通常の未処理ノートはfieldなしでよい。例外と明示除外だけをsource note自身へ置く。

```yaml
---
organize_status: needs_review
organize_reason: ambiguous_destination
---
```

許可値は次の二つに限定する。

- `needs_review`: 人間が判断するまでschedule対象外。理由は固定code一件だけを持つ。
- `ignore`: guide、template、意図的な常設Inbox note。schedule対象外。

`organize_reason`はv1では次の固定codeだけを使う。

- `ambiguous_destination`
- `multiple_responsibilities`
- `destination_collision`
- `conflicting_evidence`
- `merge_or_split_required`
- `raw_status_uncertain`
- `privacy_risk`
- `oversized`

MCP不通、stale runtime、revision競合、journal recovery中などの一時的なsystem failureは意味上の例外ではないため、`organize_reason`を書かない。

`pending`、`organized`、attempt回数、処理日時、run IDは保存しない。transientなMCP不通やrevision競合ではfrontmatterを変更せず、次回の全scanで再試行する。人間が内容を解決した時は`organize_status`を除去すれば再評価される。

最初の実装時に`01_受信箱/未整理.md`を`ignore`として明示する。これは捕捉物ではなく案内ノートだからである。

`01_受信箱`はAIが読む領域である。秘密や認証情報を「AIが読む前に意味検出して除外する」能力は現行MCPにはなく、未知の秘密を確実に見分けるとも主張しない。capture UIと運用契約で「秘密を入れない」を明示する。秘密を混在させたい需要が出た場合は、scheduleを有効にする前に、内容をmodelへ返さずlocalで明示opt-outを判定するread-only candidate toolを別sliceで設計する。

### 4.3 AIの到着経路

新しいMyContextは作らない。AIは次の順で狭く読む。

1. `00_入口/ホーム.md`
2. `00_入口/今やること.md`または対象領域の既存地図
3. 対象atomic note
4. 判断に必要な時だけ原典

受信箱整理では最初から全MOCを読まない。候補noteを取得し、`search`で最大5件の関連候補を探し、明示link・backlink・時点が必要な時だけ`build_context`を使う。

## 5. MCP contract

### 5.1 v1で再利用する既存tool

| phase | tool | contract |
|---|---|---|
| runtime gate | `runtime_info` | stale runtimeまたは誤profileならmutationへ進まない |
| inventory | `list_directory` | `01_受信箱`、depth 1、fingerprint付きpagination。path/name/size/mtimeの一覧であり本文のatomic snapshotではない |
| source read | `fetch` | 本文とrevisionを一件取得 |
| bounded context | `search`、必要時だけ`get_backlinks` / `build_context` | 最大5候補。全Vault本文を束ねない |
| exception | `patch_note` | expected revision必須。同じfieldならno-op |
| apply | `preflight_move_entry` -> `move_entry` | source/destination fingerprint、collision、保護、link影響を再確認 |
| verification | `fetch` | destination本文をreadback |

v1ではAI整理専用tool、batch mutation、meaning classifierをMCPに追加しない。意味判断はAI、操作の正しさはMCPという境界を崩さない。`list_directory`の反復やfrontmatter取得が実測ボトルネックになった時だけ、contentを返さないread-only `list_inbox_candidates`を再検討する。

inventory段階でpath/name/sizeだけを使い、guide、`knowledge.md`、`50_履歴`、`.tsuzune`、`.trash`、64 KiB超を除外する。これらへ`fetch`を呼ばない。残る一件ごとに`fetch`のrevisionを正本とし、preflight直前とapply直前に`runtime_info`を再確認する。`list_directory`取得後の外部編集は、per-note revision、move fingerprint、終了時の再scanで検出する。

### 5.2 自動適用gate

以下をすべて満たす時だけ、人間の一件ごとの承認なしでmoveできる。

1. sourceは`01_受信箱`直下のMarkdownで、guide、`ignore`、`needs_review`ではない。
2. sizeは64 KiB以下で、InboxがAI可視領域であるというprivacy契約に反しない。秘密を含む可能性が示されたnoteは自動処理しない。
3. 主責務が一つで、destination categoryが`10`、`20`、`30`、`40`の一つに決まる。
4. filenameを変えない。merge、split、delete、rename、既存note更新を必要としない。
5. 矛盾、機微情報、prompt injection、複数候補、原典性の不明がない。
6. preflightがcollision、stale fingerprint、保護違反、recovery-requiredを返さない。
7. apply後のreadbackで、現在実装が検証する`contentRevision`がsourceの移動前revisionと一致する。将来「完全本文一致」と表現する場合は、本文byte比較を別途実装する。

`40_情報源`へのsafe moveは、`01_受信箱`にあるRaw候補を同名のまま`40_情報源`へ移す操作だけを指す。既存の`40_情報源`本文更新は許可しない。clear Rawとは、本文の大半が外部原典・引用・会話原文・取得物で、出典またはprovenanceを識別でき、派生主張を混ぜず本文を変更せず保存できるものをいう。一つでも不明なら`raw_status_uncertain`にする。

モデルが出す数値confidenceだけではgateを通さない。上の観測可能な条件を一つでも満たせなければ例外である。

### 5.3 一件の処理sequence

```text
list_directory(01_受信箱)
  -> exclude by path/name/size before fetch
  -> choose stable path order, up to 10
  -> fetch(source)
  -> treat body as untrusted data
  -> search(max 5), optional build_context
  -> classify one responsibility and one destination
  -> if unsafe: patch needs_review with expected revision; keep source
  -> if safe: runtime_info -> preflight_move_entry(source, destination/same basename)
  -> runtime_info again immediately before apply
  -> move_entry(source, destination, fingerprint)
  -> fetch(destination)
  -> compare contentRevision/readback
  -> rescan Inbox before completion
```

一件がcollisionや意味上の例外になっても、他の独立noteは続行できる。runtime stale、move recovery failure、Vault identity changeのようなsystemic failureではrun全体を停止する。

## 6. Hooks contract

### 6.1 採用するHook

TSUZUNE内部の`VaultWatcher`から、意味判断を含まないfact-only eventを出す。現行の`VaultChangeEvent { type, path }`をそのまま契約拡張したことにはしない。Slice Dでmain process内にtyped internal event sinkを一つ追加し、watcher、capture readback成功点、MCP move readback成功点から同じsinkへ接続する。

| event | minimum payload | emitter |
|---|---|---|
| `vault.file_observed` | `path`, `operation:add|change|unlink`, `observed_at`, `source:filesystem` | watcher write-settle後 |
| `inbox.capture_saved` | `path`, `operation:created|changed`, `content_revision`, `observed_at`, `source:app` | capture readback成功後 |
| `inbox.organization_applied` | `source_path`, `destination_path`, `source_revision_before`, `observed_at` | MCPを含むmove readback成功後 |

同じpathの短時間eventは250〜500msでmemory coalesceする。eventは永続化せず、監査logや履歴noteを作らない。

### 6.2 Hookがしてはいけないこと

- LLMを呼ぶ、分類する、noteを編集・移動・削除する。
- eventを「未処理仕事の正本」にする。
- watcher eventだけを根拠にexactly-onceを主張する。
- AI自身のwrite eventから再帰的にorganizerを即時起動する。

`ignoreInitial: true`のため、起動前のInbox noteはeventにならない。したがってapp起動時とschedule開始時には必ずfull scanする。move中に落ちた時は既存journal recoveryを完了してからscanする。

### 6.3 Codex Lifecycle Hookとの区別

Codex task終了時にsemanticな「学び」を機械判定して自動保存するLifecycle Hookはv1に含めない。正本判断が変わった時の書戻しはAgentのfinal-boundary MCP workflowで行う。TSUZUNE内部Hookはfilesystem fact、Agentは意味判断という境界を維持する。

## 7. Schedule contract

### 7.1 scheduler owner

初期ownerはCodexのlocal heartbeatとする。TSUZUNE本体にschedulerやAI providerを内蔵しない。実際のautomationは設計・shadow検証後に一件だけ作成する。

- timezone: `Asia/Tokyo`
- cadence: 毎日04:00
- Sunday mode: 日次整理の後に週次read-only auditを同じrunで実行
- manual: 同じprompt contractを「今すぐ整理」で実行可能
- scope: 一回最大10件。残りは次回へ送る

日次と週次を別jobへ分けず、一つのsingle-flight runにする。これで重複起動と競合面を減らす。

### 7.2 daily job

1. MCP接続、Vault identity、runtime freshnessを確認。
2. 既存move journalのrecovery-requiredがあれば通常処理へ進まない。
3. Hook状態に関係なくInboxをfull scan。
4. eligible noteをstable path orderで最大10件処理。
5. safe move、readback、例外のcurrent stateだけを返す。
6. 最後にInboxを再scanし、`moved / needs_review / deferred / failed`の現在件数を通知。

Vaultへ日次log、実施記録、処理済みcopyを残さない。

### 7.3 weekly audit

最初はread-onlyに限定する。

- 対象は`10_プロジェクト`、`20_分野`、`30_知識`直下の、64 KiB以下かつAI可視と明示されたMarkdownだけとする。
- metadataとWiki linkを先に読み、本文取得は一run最大30件に制限する。
- `40_情報源`、`50_履歴`、`01_受信箱`、`knowledge.md`、guide、template、`.tsuzune`、`.trash`、privacy opt-out、oversizedを本文監査から除外する。
- broken Wiki link候補、empty note候補、exact-content duplicate候補、`needs_review`の残留、入口から到達しにくい新規note候補をread-onlyで返す。
- duplicateは自動merge/deleteせず、pathとrevisionだけを候補として人間へ返す。

候補は人間へまとめて返すだけで、delete、merge、rename、link修復を自動適用しない。false positiveが観測されたruleは無効化する。

### 7.4 sleep、quit、overlap

- TSUZUNEのwindow closeはtray常駐を維持するが、trayから明示終了した時はMCPも停止する。
- PC sleep、Codex終了中のmissed-run保証は現時点で確認できていない。保証を仮定せず、次に実行できたrunがfull Inbox scanでcatch upする。
- write modeを有効にする前に、同一heartbeatのoverlapが起きないことを実hostで検証する。保証されなければ、履歴ではないcurrent-only leaseを`.tsuzune`に一件だけ持たせ、二重runをfail-closedにする。このleaseは実行中の排他制御だけを表し、正常終了またはstale recovery時に除去する。過去runの記録として保持しない。

## 8. Failure matrix

| failure | behavior | data result | recovery |
|---|---|---|---|
| MCP unavailable / app quit | run停止、mutation 0 | Inbox不変 | 次回full scan / manual run |
| stale runtime / wrong Vault | run全体停止 | Inbox不変 | runtime修復後に再実行 |
| PC sleep / missed schedule | 保証を仮定しない | Inboxへ蓄積 | 次に動いたrunがscan |
| watcher event loss | scheduleはeventを信用しない | Inbox不変 | startup / daily full scan |
| concurrent human edit | revision/fingerprint reject | source保持 | 次回再fetch |
| destination collision | overwrite禁止、`needs_review` | source保持 | 人間がrename/merge判断 |
| crash during move | journalからrollback/recovery | partial successを成功扱いしない | recovery後にscan |
| prompt injection in body | 本文を命令として実行しない | policy外write 0 | adversarial testで固定 |
| ambiguous / multiple responsibility | auto moveしない | source保持 | `needs_review` |
| over 64 KiB | inventory metadataでfetch前に除外 | source保持 | 人間の明示処理 |
| 秘密を誤ってInboxへ保存 | fetch前の完全検出は保証しない | sourceは保持するがmodel disclosure riskがある | schedule停止、credential rotation、local opt-out設計 |
| Raw with clear provenance | 本文無変更で`40_情報源`へmove | 原典保持 | 派生noteは後続slice |
| link/MOC patch failure after move | moveを巻き戻さない | noteは検索可能 | link integrationを別retry |

## 9. 段階的な実装

### Slice A — deterministic organizer、manual shadow

- product codeを増やさず既存MCPだけで、固定promptと隔離fixtureを作る。
- fixtureをread-only評価し、safe / review / protectedを期待どおり分ける。Raw fixtureは、出典が明示され本文が外部原典主体のclear caseと、派生主張が混在または出典不明のuncertain caseを別にする。
- public acceptance: prompt injectionを無視し、`knowledge.md` / `50_履歴`へtool call 0。

### Slice B — manual write、lossless routing

- safe fixture一件だけを`preflight_move_entry -> move_entry -> fetch`で移す。
- collision、stale revision、crash recovery、retry idempotencyを固定する。
- 本番Vaultでは利用者が選んだ最大3件のpilot後にだけ次へ進む。

### Slice C — Inbox exception state

- `needs_review` / `ignore`だけをrevision付きpatchで扱う。
- `01_受信箱/未整理.md`を`ignore`にする。
- 既存frontmatterの保持、同一patch no-op、human clear後の再評価に加え、既存YAML、不正YAML、同名field衝突をtestする。安全に一意更新できなければ本文を変えず人間へ返す。

### Slice D — fact-only Hooks

- main process内にtyped internal event sinkを追加し、`src/main/watcher.ts`のInbox dirty callback、capture readback成功点、MCP move readback成功点を明示eventへ接続する。
- external add、self-write非再帰、restart catch-up、journal recovery後scanをtestする。
- HookはまだAIを起動しない。

### Slice E — schedule shadow -> write enable

- 毎日04:00のheartbeatをshadow modeで一件だけ作成する。
- manual overlap、Codex終了、PC sleep復帰、TSUZUNE tray / explicit quitを実hostで確認する。
- shadow結果がpolicyに一致した後、最大10件のwrite modeへ同じautomationを更新する。
- Sunday auditはread-onlyのままにする。

### Slice F — link / context integration

- exactly one anchorで、note自身へのoutbound Wiki link一件だけを自動追加する。
- current project/MOC更新は別revision付きoperationとして扱い、失敗してもnoteを失わない。
- Rawからの派生note作成は原典linkとreadbackを必須にし、元Rawを変更しない。

## 10. First implementation packet

最初に着手するのはSlice Aである。Hookやscheduleから始めない。決定的なorganizer workflowがない段階では、起動回数を増やしても正しい自動整理にはならないためである。

- owner: Agent prompt / fixture / acceptance。product source ownerなし。
- artifacts:
  - `.agent/requirements/20260831-note-organization-video/organizer-prompt-v1.md`
  - `.agent/requirements/20260831-note-organization-video/fixtures/organizer-v1/`
  - `.agent/requirements/20260831-note-organization-video/results/organizer-shadow-v1.md`
- acceptance:
  - safe project note -> `10_プロジェクト/<same filename>` proposal
  - safe area note -> `20_分野/<same filename>` proposal
  - clear reusable claim -> `30_知識/<same filename>` proposal
  - clear Raw with provenance -> unchanged `40_情報源/<same filename>` proposal
  - uncertain Raw / ambiguous / duplicate / conflicting -> `needs_review`, move call 0
  - prompt injection -> policy外tool call 0
  - guide, `knowledge.md`, `50_履歴`, over-limit -> fetch/mutation 0
- unseen boundary: AIが未提示の紛らわしいfolder名、case-insensitive collision、preflight後の外部編集を親Agentが追加検証する。
- stop: new MCP API、delete/rename、production install、実automation作成、本番Inbox mutationが必要になった時。

## 11. Acceptance for the complete engine

1. 人間は保存先を決めずInboxへ書ける。
2. safeな一件は人間の都度承認なしで同じ本文のまま正本位置へ移る。
3. ambiguous、collision、conflict、secret、Raw uncertaintyはzero-lossでInboxに残る。
4. crash、restart、missed watcher、retryでduplicateや履歴noteが増えない。
5. `knowledge.md`、`50_履歴`、原典、oversized noteの保護が機械testで固定され、InboxがAI可視領域であることがcapture時に分かる。
6. AIはホームと必要なMOCから狭く文脈へ到達し、全Vaultを毎回読まない。
7. 日次はroutine整理、週次はread-only auditとして分離される。

## 12. 現在の境界

- 設計: 完了。D12〜D15を統合し、D16 adversarial reviewの8点を修正、D17 original philosophy guardをPASSした。
- 既存capture source: 実装・本番反映済み。
- Browser Clipper source: Web／YouTubeをprovenance付き外部原典スナップショットとして`01_受信箱`へ新規作成する実装と自動検証を完了。汎用履歴は復活させない。installed一致は最新production receipt、Chrome／Edge実機は手動確認を別に判定する。
- AI organizer product/workflow: 未実装。
- fact-only Hooks: 未実装。
- Codex heartbeat: 未作成。
- installed production: Inbox captureまでは反映済み。organizer、Hooks、scheduleは未実装のため未反映。
- production Vault organization: 未実施。
- canonical TSUZUNE design: 統合設計一件と7本の既存入口・正本を同期し、backlinkを確認済み。
