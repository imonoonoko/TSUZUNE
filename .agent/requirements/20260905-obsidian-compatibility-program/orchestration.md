# Obsidian Compatibility Program Orchestration

## Packets

1. `core-parity-audit`: authoring、files、Properties、Search、links、settings、workspaceのcurrent source/test evidenceを分類する。
2. `structural-parity-audit`: Graph、Canvas、Bases、excluded files、bookmarks等のcurrent source/test/evidenceを分類する。
3. `first-p0-implementation`: 統合順位の先頭一件だけをRED -> GREENで実装する。
4. `independent-verification`: 実装者が使わなかったfixture／再起動境界を一件以上検証する。

## Ownership

- CEO-01（親Agent）: Task Contract、公式source統合、P0採否、code統合、未提示境界検証、repository／TSUZUNE正本、利用者説明。
- 調査員: 指定surfaceのread-only証拠抽出。code、Vault、Git、runtimeを変更しない。
- 制作員: 親が選定後に指定した排他的fileだけを変更する。契約外設計へ広げない。
- 検証員: baseline revision／対象主語を明記し、defect-firstで独立受入する。

## Integration Policy

- 公式Helpは機能面の基準、実機fixtureは細かな公開挙動、repository source/testsはTSUZUNE現在値の基準とする。
- 歴史資料のPASSは現在sourceで再現できるまで `not_proven` とする。
- 同じ行を複数packetで判定した場合、親がexact path/test/観測時点を再取得して一件に統合する。
- 新規dependency、DB、daemon、cloud、広いruntime abstractionは追加しない。

## Verification Order

Official surface -> current source/test evidence -> ledger classification -> RED public behavior -> minimal implementation -> focused GREEN -> unseen boundary -> typecheck/relevant regression -> canonical writeback.

## Stop Conditions

- current dirty changesと所有範囲が重なるが意図を確定できない。
- parityにdelete／overwrite／Vault外write／外部送信が必要になる。
- 第一P0が複数独立featureへ膨らむ。
- production updateまたはGit deliveryが必要になる。

## P0-3 completed routing

`packets/p0-3-typed-core.md` owns only core/frontmatter and its dedicated typed tests; `packets/p0-3-independent-review.md` owns read-only final safety checks. Both were invoked with gpt-5.6-terra / high. Parent owns editor/styles, App/disk acceptance, integration and final repository/Vault writeback. Independent review was refreshed after the late display-parser reload correction. Final hashes, 117 focused / 1099 full tests, additional caller checks, observed rework and remaining boundaries are in `results/p0-3-properties-number-list.md`; current state remains owned by `state.json`.
