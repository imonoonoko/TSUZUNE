# 要求

## Task Contract

非自明なtaskは、会話、計画、またはartifact上で次を一度だけ確定する。

- `objective`: 利用者に返す結果
- `deliverables`: 作るもの、変えるもの、または確定する判断
- `constraints`: 指示、認可、安全、dirty worktree境界
- `success`: 1〜3件の観測可能な完了条件
- `lane`: Direct / Planned / Orchestrated
- `evidence`: 実行する検証と保存先
- `stop`: 完了、承認待ち、または権限拡張が必要になる条件

推論できる項目を利用者へテンプレート入力させない。taskの規模が変わった場合だけ更新する。

## 3 lane

### Direct

単一成果、依存stepが少ない、独立packet不要。チャット内contractで実行する。

### Planned

複数の依存step、設計判断、またはdurableな再開点が必要。`update_plan`またはrepo既存planを使う。

### Orchestrated

独立trackが2件以上、別検証者が有益、大規模変更、または長期再開が必要。durable orchestration artifactとself-contained packetを使う。

## 役割分担

- `orchestrate-skills`: requestからlaneと最小Skill stackを決める入口。実装責務を持たない。
- `ai-coding-operator`: Task Contractのowner。現物調査から統合、検証、終了判定までを実行する。
- `codex-dynamic-workflows`: Orchestrated laneだけのcontrol plane。packet、依存、状態、統合を管理する。
- specialist Skills: domain固有の変更または検証だけを担当する。
- `tsuzune`: current contextの取得とfinal-boundary writebackを担当する。
- `tsuzune-execution-record`: 監査価値のあるtaskのevidence packetを実施記録へ変換する。
- parent agent: 最終統合、未提示境界検証、利用者説明、本番TSUZUNE書込みを保持する。

## 状態

`discovered -> contracted -> executing -> verifying -> persisted -> complete`

`blocked`は権限、外部状態、または契約外変更が必要な場合にのみ使う。`complete`はsuccessと必要なwritebackが満たされた場合だけ使う。

## 受入条件

1. global AGENTSと主要Skillが同じTask Contract、3 lane、状態語彙を参照し、責務が重複しない。
2. 変更したすべてのSkillがCodex validatorを通る。
3. realisticなDirect、Planned、Orchestrated各requestで、lane、Skill stack、検証、停止条件を一意に導ける。
4. 既存の安全境界、TSUZUNE revision/writeback契約、subagent禁止範囲、Ponytailの理解優先を退行させない。
5. 新runtime、Hook、DB、daemon、外部依存は0件。
