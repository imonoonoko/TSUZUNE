# Context Source Descriptors — 2026-08-18

## 結論

`build_context.included[]`へ必須の`revision`と`modified_at`を追加した。各値はContext本文を選んだ同一Vault snapshotの`NoteDocument`から生成され、変更のないfixtureでは同じノートの`fetch.metadata`と一致する。

これは取得根拠の監査と再取得判断を補助するread-only descriptorであり、書き込み許可ではない。`update_note`などの前には従来どおり直前の`fetch`と`expected_revision`照合を行う。

## 実装境界

- 既存`build_context`のservice変換層だけでdescriptorを付与した。
- 既存`revisionFor(rootPath, note)`を再利用し、追加filesystem read、Hook、cache、DB、新規toolは追加していない。
- Coreの候補選定、Markdown本文、`character_count`、`max_characters`予算、`omitted_ids`は変更していない。
- MCP output schemaでは両フィールドを必須文字列として公開した。

## TDDと契約検証

1. 既存48 testsがPASSするbaselineを確認した。
2. 全included sourceのdescriptorと`fetch`一致、1ノート変更時にそのdescriptorだけが変わる2 testsを追加し、両方が`undefined`でREDになることを確認した。
3. service実装後、既存のexact object testsを新しい必須契約へ更新し、50/50 PASSを確認した。
4. public output schemaとwire上の`fetch`一致をsmokeへ追加し、schema未実装時のREDを確認してからGREENにした。

## 固定fixtureの効率測定

条件は既存baselineと同じfixture SHA-256 `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e`、Context budget 4,000文字。`node scripts/measure-progressive-context.mjs`で測定し、fixture copyの前後digest一致を確認した。

| 起点 | included | 既存baseline | descriptor追加後 | 増分 |
| --- | ---: | ---: | ---: | ---: |
| TSUZUNE | 9 | 8,843 bytes | 9,977 bytes | +1,134 bytes |
| ONOKO・CodexAtelier・Forest Room | 4 | 9,392 bytes | 9,896 bytes | +504 bytes |
| 宵灯工房 | 6 | 9,420 bytes | 10,176 bytes | +756 bytes |
| 合計 | 19 | 27,655 bytes | 30,049 bytes | +2,394 bytes（+8.66%） |

追加量はcompact structured JSONで1 sourceあたり126 bytesだった。Temporalのincluded 1件も2,046→2,172 bytes（+126）で、`content_omitted`と`UNSCOPED_NORMAL_CONTENT_OMITTED`を維持した。

Freebuff 15-tool定義JSONは24,613→24,699 characters（+86、+0.35%）。server instructionsは134 charactersのまま変わらない。

## revision監査だけに使う場合

複数根拠fixtureではincluded 9/9のdescriptorが個別`fetch.metadata`と一致し、既知4 sourceにもすべて到達した。

4 sourceの本文がすでにContext内にあり、追加fetchの目的がrevision監査だけだと事前に定義できる場合に限り、能力上は次の差になる。

- tool calls: `build_context + 4 fetch = 5` → `build_context = 1`（80%減）
- audit-only fetches: 4 → 0
- structured response: 20,820 → 9,977 bytes（約52.1%減）

これは実作業で4 call削減を観測した結果ではなく、固定fixtureでdescriptor一致を確認した反実仮想の能力値である。本文取得が必要なsource、`omitted_ids`、truncated本文、provenance確認、書き込み直前のguardには`fetch`が残る。

## 検証結果

- `npx vitest run tests/mcp-service.test.ts --maxWorkers=1`: 50 PASS
- `npm run typecheck`: PASS
- `npm test`: 760 PASS / 1 SKIP
- `npm run check:mcp`: PASS（direct smoke 17 tools、Freebuff 15 tools、definition 24,699 characters）
- `git diff --check`（対象7 files）: PASS。LF→CRLF warningのみ
- independent Ponytail review: P0/P1/P2 findings 0

## 未主張

- bytesはhost-visible token、料金、回答品質の証明ではない。
- `revision`はVault root、path、mtime、size、本文から作るopaque tokenであり、content hashやcross-Vault IDではない。
- `modified_at`はfilesystem時刻であり、知識内容の意味上の更新日ではない。
- descriptorは返却後の同時変更を防がない。

## 実行上の補足

既存baseline reportにあった`npm run measure:progressive-context`は現在の`package.json`に存在せず失敗した。残っている正本スクリプトを直接`node scripts/measure-progressive-context.mjs`で実行し、baseline reportの実行例も同じコマンドへ訂正した。
