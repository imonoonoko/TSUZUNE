# Sync Core v2 Discussion Log

## Architecture Selection - 2026-09-02 04:17

### User Input
> TSUZUNEのノート同期機能をObsidian並みに強化したい。新しい同期エンジンとかの方が良いかも。じゃあそれで。

### Codex Proposal Or Question
既存Google Drive同期を全面廃棄せず、同期判定・競合・削除・履歴をprovider非依存のSync Core v2へ分離し、Google Driveを最初のtransport adapterとして再利用する案を提示した。

### Decisions
- Accepted: Sync Core v2と既存Google Drive adapterの組み合わせ。
- Accepted: 既存同期動作を変えない可逆なfoundation sliceから開始する。
- Rejected: 既存Drive serviceへの機能継ぎ足しだけでObsidian級を目指す。
- Rejected: 専用同期server、account基盤、mobile clientを最初から同時実装する。
- Open: remote E2EEとDrive上の平文Markdown可読性の優先順位。

### Rationale
現行実装にはChanges API、remote version、stable Drive file ID、競合保全、tombstone、2 profile往復受入がある。transportを捨てるより、Drive固有名を持つ純粋な同期判定を共通coreへ分離する方が、小さく可逆で既存証拠を再利用できる。

---

## Foundation Verification - 2026-09-02 04:22

### Codex Proposal Or Question
Drive固有の純粋plannerを`src/core/sync-engine.ts`へ移し、旧`drive-sync.ts`を互換wrapperとして残すfoundationをTDDで実装した。

### Decisions
- Accepted: data schemaとremote objectを変更しないprovider-neutral foundation。
- Accepted: 次の実装sliceをstable logical IDとmove＋editに限定する。
- Open: E2EE、version retention、mobileを最初の追加端末に含めるか。

### Rationale
REDは新module不在で失敗し、GREEN後はfocused 48 tests、typecheck、全98 files／941 testsがPASSした。既存Drive同期挙動を変えずに次のstate modelを置く場所ができた。

---

## F2 Stable Identity — 2026-09-02

- Owner directive: 「お金かからないようにね。進めて」。有料同期サービス、専用server、従量課金API、新規クラウド基盤を追加しない。
- Reused: 既存Drive `fileId`と`pendingMoves`をlogical IDとしてSync Coreへ渡す。新DB、新dependency、別ID registryは作らない。
- Acceptance: local move＋editはmove→upload、remote move＋editはmove→downloadとなり、同一Drive file IDを維持して次previewが収束する。

---
