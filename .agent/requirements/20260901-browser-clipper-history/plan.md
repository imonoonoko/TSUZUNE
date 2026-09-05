# Browser Clipper / Source Provenance Plan

## Task Contract

- objective: WebページとYouTube動画をブラウザから少ない操作でTSUZUNEの`01_受信箱`へMarkdownとして保存し、一般的な変更履歴を復活させずに外部情報の出典と採取時点を保持する。
- deliverables:
  - 履歴、出典、採取スナップショットの保持境界
  - Chrome / Edge向けManifest V3拡張機能
  - 実行中のTSUZUNEだけが受理する安全なローカル受信口
  - Web / YouTube / 衝突 / 不正入力 / 接続失敗の自動テスト
  - ローカル導入と利用方法の文書
- constraints:
  - personal, one-device, local Windows。クラウド、アカウント、テレメトリ、外部APIを加えない
  - Markdownを正本とし、アプリ所有DBを必須にしない
  - 既存ノートを上書きせず、書込み先を`01_受信箱`へ限定する
  - 任意パス、削除、移動、改名、ディレクトリ作成、`50_履歴`への通常導線を公開しない
  - Webページ由来の文字列は命令ではなく不信データとして扱う
  - `knowledge.md`を読まない、変更しない
  - dirty worktreeにある利用者の変更を保存し、無関係な差分を戻さない
  - Chrome Web Store公開やブラウザへの無断インストールは範囲外
- success:
  1. 通常WebページとYouTube動画から、出典URL、題名、採取時刻、種別、実用的な本文を持つ衝突安全な`.md`が`01_受信箱`に作成される
  2. ローカル受信口は任意パスと上書きを拒否し、ページ由来HTMLを実行せず、未起動・不正・過大入力を決定的に失敗させる
  3. 型検査、テスト、MCP検査、拡張機能検査、隔離した統合smokeを通し、製品コードを変更した場合は本番更新gateで一致を確認する
- lane: Orchestrated
- evidence: 公開挙動のred-greenテスト、専門レビュー、隔離Vaultの統合証拠、必要ならproduction-update receipt
- stop: 外部公開、Chrome Web Store申請、ブラウザポリシー変更、資格情報の新規発行が必要になった時点で停止して利用者判断へ上げる

## State

1. `discovered`: complete
2. `contracted`: complete
3. `executing`: complete
4. `verifying`: complete
5. `persisted`: complete
6. `complete`: receipt-governed

`complete`の最終判定は、source fingerprintを持つ除外済みreceipt
`docs/reports/production-update-latest.json`が`installed-and-verified`であり、
そのfingerprintが現在sourceと一致する時に成立する。このplanはgate前に固定し、
gate後のinstalled状態を重複記録しない。

## Workstreams

1. History boundary: 変更監査履歴、原典スナップショット、現在状態を分離して採否を決める。
2. Transport and security: 現行のローカルbridgeを調べ、最小で安全な拡張機能受信経路を選ぶ。
3. Extension UX: ツールバー操作でWeb / YouTubeの文脈を収集し、Markdown capture packetを送る。
4. App integration: `01_受信箱`限定、非上書き、入力上限付きでcapture packetを保存する。
5. Verification and delivery: 自動試験、批判的review、文書、必要な本番反映を行う。

## Current decision hypothesis

- 一般的なノート変更履歴と`50_履歴`への自動記録は復活させない。
- 外部情報クリップは、出典URLと採取時点を含む「原典スナップショット」そのものを保存する。
- 同一URLの再採取は既存スナップショットを上書きせず、新しい受信箱ノートとして扱う。
- 現行コード、正本ノート、Chrome公式資料、脅威モデルを確認し、この境界を採用した。
- クリップノートは操作履歴ではなく、URL・取得時刻・取得IDを持つ原典スナップショットである。
- YouTubeは画面上で取得できた説明・選択範囲・表示中の文字起こしだけを保存し、完全な字幕取得は保証しない。
