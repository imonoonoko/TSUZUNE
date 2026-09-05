# 観測宙域 MVP Scope（R5）

## In Scope

- 通常Graphとは別の「観測宙域」tab。
- 解決済みMarkdown noteだけから作る、最大72実ノート粒子の決定的な連続field。Wiki link、名称、更新時刻、AI推論は運動へ使わない。
- 移動する一時的な潮目へ各回15〜35%の粒子だけが参加し、漂流、近距離反発、減衰、境界復元と重なって、集合・離脱・別構成への再編を生む。
- 一枚のCanvas、短い残光、局所密度の淡い発光。固定scene、固定cluster、中心node、線、背景用の架空星を置かない。
- 常設操作は一時停止／再生だけ。pointerまたは一つのkeyboard focusから実ノートを直接開ける。
- reduced motion、document visibility、graph差替え、unmountでrAFを正しく停止・再開する。
- 空、singleton、star-only、dense、graph更新中の安全な表示。
- offscreen Electronによるdense 589/4175の0〜60秒時系列、compact、pause／resume、direct-open、singleton 1/0の受入。

## Out of Scope

- 全量Graph、Wiki-link edge、固定星座、camera、pan、zoom、背景drag、`GraphEdgeCanvas`の再利用。
- 意味距離、重要度、存在度、真のclusterを位置・色・大きさへ割り当てること。
- LLM、embedding、vector DB、新規package、daemon、外部API、常時background処理。
- AIによるlink追加、ノート生成、正本化、自律書込み。
- 通常Global／Local Graph、Markdown、MCP、Vault schema、本番binaryの変更。

## Future／Research

- 出典、時点、履歴、選定理由、欠落、不確実性を入力として明示できるObservation Engine。
- Sourceと視覚的・操作的に分離した、provenance付きIdea Proposal。
- 利用者の明示評価による局所的な提示調整。
- 長時間で新しい集団や予期しないidea候補を生むLiving Cosmos。R5の実見価値と誤読防止を確認してから扱う。

## Stop Boundary

source、tests、build-bound offscreen受入、全体回帰、設計記録までを完了境界とする。本番反映と利用者の鑑賞受入は別ゲートであり、このwork itemでは画面を自動で開かない。
