# X1-T1 Structured-only Transport Measurement Protocol

状態: Codex Desktop local MCPで検証済み（本番更新は別gate）
更新日: 2026-08-12

## 目的

X1-T1は`build_context`だけで、同じ値をlegacy textと`structuredContent`へ二重搬送している部分を比較する。次の三つを混同せずに扱う。

1. Context Markdownの文字数
2. MCP wire frameのUTF-8 byte数
3. ホストが実際にモデルへ渡したinput token数

1と2はローカルで再現可能な計測値であり、3はCodex Desktopが当該呼出しに結び付いたusageを公開した場合だけ計測する。byte数、文字数、tokenizer推定値を3の代わりに使わない。

## 固定条件

- 同一のVault fixture、`as_of`、query、context budget、server revision、結果schemaを比較の両側で固定する。fixture snapshotのdigestをrecordし、後から別Vaultへ置換しない。
- Desktop確認は、ローカルstdio MCPを公開するCodex Desktopで[既存benchmark](../../../docs/reports/tsuzune-with-without-benchmark-2026-08-09.md)の固定4問とseed pathを使う。質問、prompt、tool呼出し順、利用可能ならmodelとDesktop versionをrecordする。
- stdio契約は`scripts/check-mcp.mjs`が作る一時Vaultで検査する。本番Vaultはread-only fingerprintだけを取り、測定中に書き込まない。
- legacyとcandidateをそれぞれ同じ入力で連続2回実行する。Context Markdownの`Generated:`行だけは生成時刻という可変メタデータなので、`Generated: <volatile>`へ正規化してcanonical metricsを作る。正規化前のMarkdownは別途recordし、他の値を正規化してはならない。2回のcanonical metricsが一致しなければ、削減値を採用せず決定性failureとする。

固定4問:

1. 現在動いているプロジェクトは何か。
2. 2026-07-22時点では何が動いていたか。
3. 再確認が必要な情報は何か。
4. この状態を採用した根拠は何か。

固定seed path:

- `10_プロジェクト/TSUZUNE.md`
- `10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md`
- `10_プロジェクト/宵灯工房.md`

## 比較する結果形状

`S`は現在の`build_context`が返す`structuredContent`の値とする。比較対象のlegacy形状は次である。

```ts
{
  content: [{ type: 'text', text: JSON.stringify(S, null, 2) }],
  structuredContent: S
}
```

candidate形状は次である。

```ts
{
  content: [],
  structuredContent: S
}
```

wire byte比較には、両側で同じJSON-RPC envelopeを用いる。

```ts
JSON.stringify({ jsonrpc: '2.0', id: 'x1-t1', result })
```

## 必須の計測とgate

| 観測対象 | 方法 | 合格条件 |
|---|---|---|
| 実stdio schema | 実serverへ`build_context`を送る | `structuredContent`が既存schemaのまま返る |
| transport形状 | candidate resultを直接検査 | `content`が厳密に`[]`。他の6 toolはlegacy形状のまま |
| 意味同一性 | legacy/candidateと各2回の`S`を比較 | `included[].path`、`omitted_ids`、warnings、`Generated:`だけを正規化したContext Markdown SHA-256、canonical `JSON.stringify(S)`が全て一致 |
| 補助値 | Context Markdown chars、Markdown UTF-8 bytes、`JSON.stringify(S)` UTF-8 bytesをrecord | 値を記録するだけで、model token削減とは表現しない |
| wire削減 | canonical JSON-RPC frameのUTF-8 bytesを比較 | candidateがlegacyより45%以上小さい |
| latency | `client.callTool`を10 warmup後30回測定しp95を比較 | candidate p95がlegacy比10%超悪化しない |
| Vault安全性 | fixtureと本番read-only fingerprintの前後比較 | 測定起因のVault writeが0 |

どの必須gateも満たさなければshipしない。失敗時はtransport変更だけを戻し、candidate selection、MOC、Temporal、provenance、warningには触れない。

## Codex Desktop互換性と回答品質

Codex Desktopのfresh taskから、同じ質問、prompt、tool sequence、fixture snapshotを使う。各runで利用可能ならDesktop versionとmodel、source表示、回答、参照path、使用したresult形状をrecordする。

- 固定4問の回答品質: 4/4
- source trace: 3/3
- future-state leakage: 0

このCodex Desktop gateが合格するまで本番transport rolloutは行わない。ChatGPTはローカルstdio MCPへ直接接続しないため、このlocal transportの受入hostではない。ChatGPT連携を要求する場合は、Secure MCP Tunnelなどのremote MCP経路を別Trackで設計・検証する。互換性failure時はstructured-only transportだけをrollback対象とする。

## Model-visible tokenの観測境界

hostがlegacy/candidate条件に対応するper-callまたはper-turnのinput token使用量を明示的に公開するときだけ、その中央値を比較する。candidateの中央値が低い場合に限り、model-visible token削減として記録する。

現行repository、MCP SDK client、stdio resultには、ホストがモデルへ渡したtoken使用量を結び付けて返す経路がない。その場合の状態は`not_observable`とし、wire byte gateだけを判断できる。tokenizer導入、推定値、要約、generic response profile、新依存を、この観測不能を埋めるために追加しない。

## 今回の境界

この文書は、Codex Desktop local MCPの受入範囲だけを定義する。ChatGPT remote MCPの実装・公開・検証は認可しない。
