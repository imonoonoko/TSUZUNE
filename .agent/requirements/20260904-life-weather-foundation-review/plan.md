# TSUZUNE LIFE Weather Foundation Review

## Goal

TSUZUNE LIFE Weatherを、現在のWebGL2隔離prototypeの延長ではなく、TSUZUNE内での提示方法、資料変換、時間構成、描画技術、言語、実行境界、鑑賞検証を含む一つの芸術基盤として再評価し、次に実証する一案を決める。

## Task Contract

- objective: 本人のVaultが別の素材へ交換できない固有の生成芸術として立ち上がり、説明UIや技術デモへ退かない基盤を選ぶ。
- deliverables: 現行経路監査、作品原理、技術・言語・配置候補比較、採用／不採用理由、最小vertical slice、7ラベル判断packet。
- constraints: dirty worktreeを保全する。現在のprototypeや製品コードを全面置換しない。新規dependency、製品配線、本番更新、Git deliveryは採用判断前に行わない。存在相そのものを粒子、場、座標、networkへ還元しない。
- success:
  1. Vault入力からTSUZUNE画面までの現行経路と、芸術性を制限している層が現物証拠で分離されている。
  2. 何もしない案と最小可逆案を含む複数候補が、芸術上限、由来性、時間、性能、配布、保守、失敗条件で比較されている。
  3. 一つの推奨基盤と、一週間以内に真偽を判定できる最小vertical slice、その停止条件が明確である。
- lane: Orchestrated。
- evidence: repository source、現行prototype実画面、production TSUZUNE正本、公式一次資料、独立packet、最終反証review。
- stop: 推奨基盤と最小実証の設計が検証され、製品置換・依存追加・本番反映の前で工房主判断へ戻る。

## Product value hypothesis

この企画は、自分の知識を保存・検索するだけでは足りない工房主が、説明を読まず眺めている間に、自分の蓄積にしか生まれない時間・再来・結び直しを作品として感じ、もう一度開きたくなったら価値がある。

## Constraints and risks

- 高性能な言語やAPIを選ぶだけでは芸術性は上がらない。作品文法と描画能力を分離して判定する。
- 参考作品の表層模倣、技術デモ、Graphの化粧、偽の資料因果へ戻らない。
- TSUZUNEは個人・一台・ローカルWindows製品であり、Markdown正本、privacy、failure時の保全を崩さない。
- 現行checkoutは広くdirtyであり、調査成果は専用directoryに限定する。

## Work packets

| Packet | Owner | Scope | State |
| --- | --- | --- | --- |
| A: artwork foundation | ART-01 | 作品の核、時間構成、鑑賞導線、失敗反証 | complete |
| B: rendering and language | RENDER-01 | 描画API、language/runtime、性能と表現上限 | complete |
| C: TSUZUNE placement | INTEGRATION-01 | app内配置、data boundary、操作と運用 | complete |
| D: current-path integration | CEO-01 | 現物call path、実画面、候補統合 | complete |
| E: adversarial acceptance | VERIFY-01 | 統合案の反証と受入 | complete — approve with corrections integrated |

## Integration policy

技術の新しさではなく、作品原理を実現する最小の基盤を採る。各packetの主張はcurrent sourceまたは一次資料へ結び、推測は分ける。衝突時は現行runtimeと工房主の実見を優先し、未確認性能は小さなspikeへ落とす。

## Verification

- workflow artifact completeness
- current source call-path trace
- official-document citation check for drift-prone technology claims
- existing prototype live inspection
- final architecture table consistency and adversarial review

## Approval boundary

read-only調査、専用artifact作成、隔離した無依存spikeは契約内。製品コード置換、新規dependency、production update、Git delivery、外部公開は別判断。
