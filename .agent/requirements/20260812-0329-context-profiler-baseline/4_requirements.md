# X1-CP0 Context Profiler Baseline Requirements

## 1. Measurement Unit

### Task

CP0-A完了後に自然発生した次のeligibleな依頼を連続順でadmitし、substantiveな探索・読取・実装より前に固定した一つのtask cardを、一つのCodex taskで完了、失敗、blocked、cancelledのいずれかへ到達させる単位。途中で別目的を追加した場合は同じrecordへ混ぜず、別task cardへ分ける。

### Successful Task

cardの必須成功条件がすべてPASSし、停止条件に触れず、要求された成果物と証拠が残ったtask。部分完了を成功に丸めない。

### Cost Per Successful Task

task成功を分母にし、観測できた時間、tool call、検索、読取、再読、再試行を個別に比較する。異なる単位を一つの恣意的な点数へ合成しない。正確なtokenまたは実費が公開された場合だけ、それらも独立した指標として扱う。

## 2. Observation Boundary

- preflightではcardを固定するためのGit状態、host表示、対象revisionだけを取得できる。source探索、問題理解、実装、subagent起動は行わず、preflightのtool eventは測定運用としてcountへ含めない。
- 開始時刻: card固定後、最初のsubstantiveなassistant actionまたはtool eventが記録された時刻。cardの`card_frozen_at`より前にはならない。
- 終了時刻: success/fail/blocked/cancelledを確定したfinal responseの時刻。
- wall-clockにはtool待機を含む。利用者入力待ちが発生した場合は除外せず、`observation_gaps`へ期間と理由を記録する。
- rootがchild agentを起動した場合、観測できるchildのtool eventを同じtaskへ合算し、`agent_runs`へ含める。
- child transcriptまたはnested tool eventが見えない場合は推測せず、`observation.completeness = partial`とする。
- task recordは、host既存履歴を参照する索引であり、Raw transcriptそのものを複製しない。

## 3. Common Record

一つの正本schemaは`task-record.schema.json`とする。実recordは`work/context-profiler/records/CP0-Txx.json`へ置く。CP1-A／CP1-Bでは同じfieldと観測境界を継承し、`CP1-A-xx.json`／`CP1-B-xx.json`として同じschemaで検証する。

必須情報:

- task ID、card参照、card固定時刻、目的、task種別、task/host/model（表示される範囲）。
- repository/Vault、Git HEAD、dirty/clean、利用可能なsource revision。
- result、success boolean、1〜3件の成功条件と証拠、停止条件と抵触有無、write境界。
- 開始／終了時刻、elapsed milliseconds。
- atomic tool call総数と種類別件数（うち`search`／`read` tag）、unique source、再読、再試行、変更file、agent run。
- usageの観測状態と、観測できた場合だけの正確な値。
- evidence refs、観測不能または不完全な境界。

## 4. Counting Rules

### Atomic tool call

外部境界へ一度requestし、一つのresultまたはerrorを受ける単位。`functions.exec`等のwrapper内で複数のnested toolを呼ぶ場合はnested toolを一件ずつ数え、wrapper自体は数えない。nested callを復元できない場合はhost-visible wrapperを数え、basisを`host_wrapper`、completenessを`partial`にする。

種類別件数は重複可能なtagである。例えば、検索結果がsource本文snippetを返した一回のcallは`search`と`read`の両方へ一件を加えてよい。そのため種類別件数の合計はtool call総数と一致しなくてよい。

### Search

複数候補からsourceまたは位置を探すcall。`rg`、TSUZUNE `search`、Git log/search、web search等を含む。同じcall内の複数queryは、hostへ一requestなら一回とする。

### Read

モデルが判断に使えるsource本文、diff、metadata、snippetを返すcall。file open/fetchだけでなく、本文snippetを返す検索も含む。単にpath一覧だけを返すcallはreadに含めない。

### Unique source

task中に本文、diff、metadata、snippetがモデルへ入ったcanonical source IDの種類数。repository fileはrepo-relative path、TSUZUNE noteはVault-relative ID、webはcanonical URL、Git objectはobject IDを使う。同じsourceのrevisionやrangeが変わってもunique sourceは一件である。

### Repeated read

同じtask内で、先に観測したものと同一の`canonical source ID + revision + normalized range`を再度モデルへ返したread event。初回は数えず、二回目以降を一件ずつ数える。

- repository fileのrevisionはGit blob ID、またはdirty/untracked fileのcontent SHA-256。
- TSUZUNE noteは`fetch`等が返すrevision。
- rangeは`full`、line範囲、JSON pointer、section等を一つの表記へ正規化する。
- revisionまたはrangeが違う場合は再読ではない。
- revision/rangeを確定できなければ0とせず、recordを`partial`にしてgapを残す。

### Retry

失敗、timeout、無結果、同じblockerの後に、同じsubgoalを達成するため追加で行った試行。最初の試行は数えない。source変更後の予定された再検証、red-green-refactorの次段階、別仮説の検査はretryに数えない。

### Changed files

task開始時のworking tree snapshotと終了時の差で、そのtaskに帰属できるpath数。既存dirty pathは、当該taskが内容を変えなければ数えない。Raw `work/` recordは製品変更fileへ含めず、record内の`changed_files`にも含めない。

### Negative evidence

「見つからなかった」を再利用できるnegative evidenceとするのは、query、scope、method、source revisionが固定され、証拠参照がある場合だけ。いずれかが変われば新しい探索として扱う。

## 5. Result And Usage Rules

- `result = pass`のときだけ`success = true`にでき、全成功条件がPASSかつ`stop_condition_triggered = false`でなければならない。
- fail、blocked、cancelledもsampleから除外しない。
- input/output token、prompt cache、reasoning token、actual costは、hostがこのtaskへ結び付けた正確な値を公開した場合だけ記録する。
- host usageがない場合は全数値を`null`、statusを`not_observable`にする。
- Markdown文字数、serialized bytes、tokenizer推定、料金表からusageを補完しない。
- task別usage値はignored `work/` recordだけに置き、Git/TSUZUNEの集計へ複製しない。

## 6. Privacy And Evidence

- `evidence_refs`はCodex task/event、repo-relative file、Git object、Vault-relative note/revision等への参照にする。
- prompt全文、tool result全文、個人note本文、absolute user path、秘密、認証情報はrecordへコピーしない。
- Gitへ出す集計はtask IDを匿名化し、task種別、pass/fail件数、中央値、再現件数、観測不能件数だけにする。
- TSUZUNEへは判断、採用/不採用、集計、repo evidence pathだけを書き戻す。

## 7. CP0-A Acceptance Criteria

- [x] `task_cards.md`にCP0-T01〜T10の予約IDが重複なく存在し、実taskを指示する架空queueになっていない。
- [x] eligible／ineligible条件、連続採取、task種別を操作しない規則が固定されている。
- [x] card templateに目的、対象、開始revision規則、1〜3件の成功条件、停止条件、write境界があり、各taskのadmit時に固定する規則がある。
- [x] `task-record.schema.json`がJSONとしてparseでき、上記必須fieldを持つ。
- [x] tool、search、read、unique source、repeated read、retry、changed fileの数え方が第三者にとって曖昧でない。
- [x] Raw、Git、TSUZUNEの保存境界が明記される。
- [x] 製品source、本番アプリ、package、installer、MCP登録、本番Vaultの測定対象本文／fixtureの変更が0である。既存project tracking noteへの契約と状態の同期はsample外として区別される。

## 8. CP0-B Completion Gate

- 10/10 cardにrecordがあり、失敗とblockedも残っている。
- success rate、elapsed、tool call、search、read、unique source、repeated read、retryを比較できる。
- schema/completenessが異なるrecordを同じ中央値へ混ぜない。
- 同じ無駄が最低3 taskに再現しない限り、CP1の介入を選ばない。複数task種別に跨るかは補助根拠として報告するが必須gateにしない。
- 10件で主因がなければ同じ連続採取を最大30件まで続けて停止する。欠落task種別を埋めるための人工taskは追加しない。
