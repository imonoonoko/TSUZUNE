# ワークスペース保存・復元 — 受入設計

設計日: 2026-09-06 JST。以下は**実装時に実行するケース**であり、現時点でPASSを主張するものではない。今回の設計検査は末尾に分離する。

## Fixtureと検証対象

隔離Vault Aに`Inbox/メモ.md`、`Research/仮説.md`、`Research/根拠.md`、対応する画像添付を用意する。Vault Bにも同名の`Research/仮説.md`を別本文で置く。二つの名前付き配置「調査」「執筆」と、空配置を使う。実Vaultを開かず、userDataとsessionDataも隔離する。外部編集・欠落・read/write/rename失敗はfixtureだけで再現する。

非active tabも順序を含めて検査し、global graphだけでなくnote／attachment／linked-viewを通す。fixtureの本文・添付は操作前後hashで確認する。本文flushを伴うケースでは、明示した編集中の一件だけを期待差分にし、他fileは不変とする。

## 受入ケース

| ID | 操作・反例 | 合格条件 |
|---|---|---|
| A1 | 四種のタブを保存し、別の構成から読込。activeを各種に替えて反復 | 種類・順序・active・左右表示・検索語・右文脈・active note modeが一致。本文は最新。runtime ID／本文をsettingsへ保存しない。非activeの重複pathも保持 |
| A2 | 日本語名、同名更新、同一内容保存、削除、空配置 | IME確定で誤保存しない。同名は明示更新だけ。no-opはsavedAtとsettings bytes不変。削除はnamed一件だけで本文・lastSession不変。空配置は空で復元 |
| A3 | タブ変更後に通常終了、fresh processで同じVaultを起動。debounce直前の終了も含む | 最終配置を復元。namedは日常操作で不変。初回／nullはlastNote互換、空lastSessionは空のまま。クラッシュは最後の成功checkpointまでと表示上の保証を限定 |
| A4 | draftありの保存／復元、外部競合、save拒否、保存待ち中の入力、capture入力、IME composition | 成功時だけ配置保存／切替。失敗時は元tab・draft・選択・競合が保持される。busy中に入力が新画面へ混入しない。IMEとcaptureを黙って破棄しない |
| A5 | A→BとA→B→Aで旧A timer／遅いIPC応答を返す。root case違い、realpath失敗も確認 | 配置と本文がVault単位で分離。mainのrootRevisionが古いmutationを拒否し、renderer世代が古いresponseを捨てる。単なるcase差は同じkey。realpath失敗は旧settings不変。Vault実移動は別keyとして扱う |
| A6 | 保存後に一件移動＋明示alias、一件削除、active削除、全件削除 | aliasだけ追従。欠落件数とpathを通知し、元indexの生存active→先頭→空の順で選ぶ。named不変。復元や通常終了だけで欠落を除いたlastSessionを上書きしない |
| A7 | scan後の外部本文更新、alias cycle／曖昧／Vault外、attachment消失 | 古い本文への上書き0。未知・不正解決は開かない。watcher／次回revision guardで競合を扱う。未解決pathを似た名前へ結び付けない |
| A8 | 復元中のVault世代変更、fresh scan失敗、連続した二つの復元、終了要求 | 古い結果と部分配置をcommitしない。元画面維持。外部イベントは排他終了後に処理。二重復元／終了が入力を消さない |
| A9 | 既存settingsにGraph／Calendar／他Vault／未知fieldを含め、workspaceと設定更新を交互実行。temp write／rename失敗、JSON破損、permission失敗 | 無関係な設定を保持。read失敗をdefaultで上書きしない。失敗前のsettings bytesを維持し成功を返さない。task-owned tempだけcleanup。配置保存失敗後の終了／戻るを選べ、本文保存失敗なら終了不可 |
| A10 | V1未知field／不正型／不正active／不正path／上限超過、保存済み未知version、全設定初回なし | 不正入力は書込0、超過を部分保存しない。既存未対応valueは保持し警告。無関係なsetting更新で消さない。初回ENOENTだけ正常作成 |
| A11 | keyboardのみ、Escape、削除cancel、High Contrast、720pxと通常幅を往復 | 一意なlabel、Tab trap、IME、非色依存状態、focus復帰が成立。狭幅でも開閉操作が見え、resizeだけで保存したsidebar希望状態を失わない |

## 実装時のgateと証明の範囲

- 型／parser／設定保存は既存Vitestを使用し、A9の失敗注入は旧bytes維持を直接assertする。DOMの見た目だけで保存安全性を判定しない。
- App safety／既存tab／RelatedNotes／設定のfocused testsに公開操作の主要ケースを接続する。中間helperだけをテストして復元成功としない。
- `npm run typecheck`、`npm test`、`npm run check:mcp`を実行する。コード変更がない今回に製品suiteを再実行する必要はない。
- 製品code変更後はrepo文書を確定してから`npm run production:update`。隔離packaged／installedでA1〜A3の代表操作とfresh process reopen、hash一致、本番profile不変、MCP更新を確認する。実Vaultは自動smokeへ使わない。
- fixed Obsidian paired比較を行わない限り、互換性台帳の`matched`へ変更しない。本人による実作業二件の往復は利用者確認として別に記録する。
- 日本語IMEはcomposition通知と最終doc反映の順序を実editorで検査し、隔離installed実機でも確定→保存／復元／終了を確認する。synthetic keydownだけをIME受入としない。

## 今回の設計検査

検査対象は保存形式と受入条件の整合、現在のsourceへの対応、参照先、既存dirty変更の保持。製品コード、設定、binaryは変更しない。

2026-09-06の設計検査結果:

- 3文書、要件W1〜W8と受入A1〜A11の対応、相対リンク6件、sourceのfile／行参照12件、TypeScript型例の構文を検査しPASS。リンク検査は存在と参照範囲、型例は構文の確認であり、実装の挙動を証明しない。
- source_state（指定実行gpt-5.6-terra／medium）の独立reviewで、Vault往復後の古い要求、IME確定、root正規化を指摘。rootRevisionを再利用するscope、IPC応答後の世代照合、composition通知と実機受入、main単一正規化を追記し、指摘箇所の再確認でP1／P2残件なし。
- reference_task（luna_scout、gpt-5.6-luna／low）が公式比較と要件／UXを確認。「選択位置」は選択中tabと明記し、checkpoint失敗後の最後の成功値・再試行契機を補足した。右文脈内の追加選択field案は、既存の表示種別を`right.view`が既に表しているため不採用。保存する表示種別の範囲は明文化した。
- `git diff --check` PASS。変更は設計3文書とPLAN／docs索引／互換性台帳の導線に限定し、既存の製品code／test変更と削除を保持した。
- 製品suite、paired比較、packaged／installed、実機IME、本人の利用者受入は未実施。今回は文書だけのためproduction update対象外。
