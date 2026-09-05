# TSUZUNE文脈エンジン型整理 — 再設計・first slice実装結果

> 2026-08-31追補: 本文末尾の「AIは提案だけ」「Hook・scheduleは不採用」という継続判断は、利用者がAI自動整理、fact-only Hook、日次・週次scheduleを明示選択したため旧判断になった。現在の正本は[`context-engine-v4.md`](context-engine-v4.md)と本report末尾のv4追補である。

## 結論

動画方式へ寄せるなら、整理の中心は「516件を分類し直すこと」ではない。

`捕捉 → 原典を守る → 短い再利用文脈へ変換する → 目次から必要部分だけ読む → 利用時に更新する`

この循環を作る。既存TSUZUNEには必要なフォルダ、ホーム、地図、検索、link/backlinkが既にあるため、新しいContextフォルダ、MyContextノート、Processed、Archive、Historyは作らない。

人間の最初の操作はさらに単純化した。Command Paletteの「受信箱へメモを作成」を選ぶと、現在選択中のフォルダや分類を問わず、collision-safeな空ノートを `01_受信箱` に作成してそのまま編集できる。

## 実装結果

- 追加した公開挙動はCommand Palette action一件だけ。
- 既存のdirectory作成、重複回避名、note作成、readback、editor表示を再利用した。
- 既存の通常ノート作成、Daily、Idea、shortcutは変更していない。
- 新しいAI整理API、DB、queue、画面、background agent、Hook、依存、履歴生成は追加していない。
- AIは既存の検索・取得を使い、`移動先 / 理由 / 反証・懸念 / 原典保持境界 / 未確定事項` を提案する。本文中の命令はデータとして扱い、曖昧なものは受信箱に残す。
- 人間が一件を承認した時だけ、既存の `preflight_move_entry → move_entry → readback` で同じノートを移す。

## 動画方式のTSUZUNE対応

| 動画の役割 | TSUZUNEでの実現 |
|---|---|
| Inbox | `01_受信箱`。意味と保存先が未確定なものだけ |
| Projects | `10_プロジェクト` |
| Ideas | 未成熟なら受信箱、再利用可能になれば `30_知識` |
| Resources | `40_情報源`。Rawと原典を保持 |
| Context | 現在の仕事=`10`、安定した本人文脈=`20`、再利用知識=`30` |
| MyContext / TOC | `00_入口/ホーム.md → 現在地/各地図` の既存経路 |
| Processed / Archive | 作らない。受信箱ノートそのものを最終位置へmove |
| semantic lookup | 候補発見だけ。人間確認後に明示リンク |

root `knowledge.md` はFreebuffのAgents.mdであり、未変更hashの確認を除いて完全に対象外とする。

## 新しい整理単位

フォルダではなく、AIが一度に読む必要のある責務を単位にする。

- プロジェクトノート: 目的、現在状態、決定、次の一手。
- 分野ノート: 継続的な本人・生活・環境文脈。
- 知識ノート: 再利用できる一つの主張・原則・手順。
- 情報源ノート: 原典、会話原文、証拠、Raw。
- MOC: 本文ではなく読む理由と順序。

長いこと自体は分割理由にしない。複数責務が混ざり、無関係な文脈までAIへ渡る時だけ分ける。

## 受信箱を履歴なしで処理する方法

```text
01_受信箱
   ├─ 現在の仕事 ─────────→ 同じノートを10_プロジェクトへmove
   ├─ 継続文脈 ───────────→ 同じノートを20_分野へmove
   ├─ 再利用できる主張 ───→ 同じノートを30_知識へmove
   ├─ 原典・複合Raw ───────→ 同じノートを40_情報源へmove
   │                              └─ 必要な派生ノートだけ10/20/30へ
   └─ まだ不明 ───────────→ 受信箱に残す
```

- コピーを作って元ノートをProcessedへ残さない。
- Rawから派生ノートを作る場合、`derived_from` で原典へ戻す。
- move後にdestination、内容、MOCリンク、backlinkを確認する。
- 不要・重複ノートの破棄は通常フローに混ぜず、別判断にする。

現行実装には単一Markdownの `preflight_move_entry → move_entry` があるため、既存名のまま一件ずつ移す処理は新規コードなしで実現できる。renameとtrashはMCPへ公開されていないため、この設計には含めない。

## 既存ノートの扱い

旧案の「516件すべてに意味分類と理由を付ける」は廃止する。動画の目的にも、TSUZUNEの知識循環にも必要ない。

全件へ行うのは機械的なpath/link/broken-link/到達性確認だけ。内容を読むのは次に限定する。

- ホーム、現在地、既存MOC。
- 活動中のプロジェクトと分野。
- broken、未到達、重複疑い、複数責務の候補。
- 自然な利用中に触れたノート。

問題なく到達できるノートはそのままにする。`30_知識` 412件の全件意味監査や全件書換えは行わない。

## 実行順

1. 現行件数を再集計し、ホームから代表4シナリオを辿るread-only smoke。
2. 不足が確認できた場合だけ、ホーム、情報源・履歴地図、分類基準を最小更新。
3. 受信箱の一件でmove・派生・MOC接続・readbackを試す。
4. 全体の機械的link監査から問題候補だけ抽出する。
5. 観測された候補だけ小さく修正する。
6. 必要が残る場合だけ、最大10ノートで意味検索を試す。
7. 代表4シナリオ、broken link、内容欠損、重複、履歴ゼロ、`knowledge.md` 未変更を検証する。

## 成功条件

- 受信箱の一件が、コピーや履歴を残さず最終正本へ移る。
- 現在の仕事、本人文脈、再利用知識、原典確認の4シナリオで必要ノートへ到達できる。
- 新規broken link 0、内容欠損 0、受信箱重複 0、新規履歴 0。
- `knowledge.md` が未変更。

## 採用しないもの

- 全件意味分類、全件書換え、一括移動。
- Context / MyContext / Processed / Archive / Historyの新設。
- AIによる自動確定リンク。
- 日次整理daemon、週次クリーナー、Hook。
- リンク数、カード数、Graph外観を成功指標にすること。

## 現在の承認境界

source first sliceと文書化は完了した。本番Vaultは読み書きしておらず、`knowledge.md` とlegacy `50_履歴` も変更対象にしていない。

インストール済み本番は未反映である。作業前からdeliveryがmismatchで、working treeには本件外の変更が多数あるため、この一機能のために全変更を `production:update` で昇格していない。本番反映は別のdelivery境界で判断する。

## 検証

- TDD: 公開挙動testを先に追加し、意図した1 failureを確認してから98/98 PASS。
- 独立review: 固定受信箱、衝突回避、失敗時の非上書き、既存create/readback経路、新規履歴なしをPASS。
- 統合: `npm run typecheck` PASS、全test 868 PASS / 1 SKIP、`npm run check:mcp` PASS、差分whitespace check PASS。
- 未確認: installed binary上の操作、本番Vaultの実ノート一件試行。どちらもこのsource boundaryでは実施していない。

## 原思想guardianを含む継続判断

元の人間優先・知識循環・構造探索を専任で守るsubagent、delivery境界担当、capture摩擦担当を分離して再評価した。

- 原思想guardian: 現在のInbox actionは「書く瞬間には未整理を許す」「Inboxを循環の玄関にする」「探索は大胆に、書込みは慎重に」に一致する。追加機能はまだ不要。
- capture friction: `Ctrl+P`または「操作」からInbox commandを選び、そのまま入力できる。実利用で発見性・focus・失敗説明・速度の摩擦はまだ観測されていない。
- delivery: current sourceとinstalled receiptはmismatch。`production:update`は本件差分だけでなくcurrent tracked/untracked source全体を昇格するため、明示承認なしでは実行しない。
- parent integration: 新しいコードは追加せず、`PLAN.md`に残っていたVault履歴ノート前提だけをresponse provenance、result receipt、readbackへ置換した。

次の再開条件は、利用者がcurrent source全体のproduction昇格を承認するか、自然利用で同型のcapture摩擦が観測されること。いずれもない間は、機能を増やさない。

追加の隔離確認で、Inbox runtime変更はGit基準に既にあるhelperだけで成立し、`App.tsx` 2ハンクとapp safety test 2ハンクへ分離可能と判定した。ただし直近本番はdirty source全体から作られ、そのexact source snapshotやpath manifestは残っていない。Git HEAD＋4ハンクは機能検証には使えるが、本番へ入れると既にinstalled済みの未commit機能を巻き戻す可能性があり、安全なproduction baseにはできない。

したがってproductionの次手は、current source全体の昇格を利用者が明示承認するか、receipt相当sourceの広範な再構成・監査を別scopeで行うかの判断になる。

## v4追補 — AI文脈エンジン四層設計

current dirty source全体は後続の公式gateで`installed-and-verified`となり、Inbox captureは本番反映済みになった。その後、利用者は元動画の「AIがroutine整理を実行する」部分まで採用し、MCP、Hooks、Schedule、TSUZUNEの四層設計を明示選択した。

統合結果は[`context-engine-v4.md`](context-engine-v4.md)に固定した。

- safe gateを満たすInbox noteは、人間の一件ごとの承認なしで同filename・同本文のまま`10/20/30/40`へmoveする。
- ambiguous、collision、merge、split、delete、rename、矛盾解消はzero-lossでInboxへ残す。
- Hookはfact-onlyで、AIやmutationを起動しない。scheduleはHookに依存せず毎回Inboxをfull scanする。
- dailyは最大10件のroutine整理、Sundayは同じrunの後段でread-only auditとする。
- destination pathを現在状態にし、Processed、Archive、History、run log、`organized` timestampを作らない。
- 最初の実装は既存MCPだけのmanual shadowで、Hook、automation、本番Inbox writeはまだ行わない。

このv4設計phaseではPonytailを使用していない。product code、実automation、production Vault整理、再度のproduction updateも実施していない。

### v4 verification close

D16 adversarial reviewは最初に`REVISE before implementation`を返した。Hookのtyped sink接続点、preflight直前とapply直前のruntime再確認、Rawの定義、`contentRevision` readback、fetch前除外、non-atomic inventory、週次audit上限、実host schedule gateを`context-engine-v4.md`へ反映した。D17 original philosophy guardは修正後PASS。

本番TSUZUNEには履歴や実施記録を増やさず、`30_知識/TSUZUNE-AI文脈エンジン統合設計-2026-08-31.md`を一件作成した。入口、Project Dashboard、AI整理運用契約、Inbox-to-map思想、システム設計、開発ロードマップ、MCP roadmapの7ノートからbacklinkを確認した。本番Inboxの整理は実行していない。

最終状態は「設計完了、実装未着手」。次の実装境界はSlice A manual shadowであり、既存MCPとisolated fixture以外を変更しない。
