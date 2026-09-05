# TSUZUNE プロジェクトレビュー — 2026-09-06

後続: 工房主が下記3点の保守を選択し、[レビュー後の保守](review-maintenance-2026-09-06.md)へ進んだ。以下は保守前のレビュー時点の指摘と判断を保持する。

レビュー結論: データ非破壊と本番受入の基盤は育っている。一方、公開対象の保護、依存関係の更新、現在状態の記述と配布の整合を先に整える価値が高い。新機能や全面再設計の着手判断は行わない。

## 対象と判定の限界

目的は、実装・本番・GitHub・計画を照合し、確認済みの問題と次の判断材料を保存すること。成功条件は、現在と過去の証拠を分離すること、指摘を具体的な経路・資料に結び付けること、次の候補を採用済み範囲と混同しないこと。

親Agent CEO-01が状態・依存関係・文書を確認し、独立AgentがBrowser Clip bridge、保存、YouTube取得と直接の呼出し経路を読取レビューした。全コードのセキュリティ監査、全機能の再受入、利用者の長期使用評価ではない。実装・設定・依存関係・インストール・Git公開は変更していない。

## 現在の証拠

| 境界 | 確認した状態 | 解釈 |
|---|---|---|
| Git | local main / origin main / GitHub main は `7892263cc6e039cde90a49e346246ed9581801e4` | PR #12の統合完了。公開対象外のlocal資料は未追跡で残る |
| 直前の検証 | typecheck、全1140 PASS / 1 SKIP、check:mcp PASS。検証したcommitとmainのGit tree一致 | 今回はソース変更がなく、全体testを重複実行していない |
| Installed | EXEとapp.asarのSHA-256を今回読み、最新production receiptと一致 | インストールされたバイナリの同一性を現在確認 |
| 本番受入の履歴 | 2026-09-05 receipt: gate 10/10、profile 273 files不変。P0-7 campaign: source / installedの4操作と再起動後10データfiles一致 | 今回のUI再操作やprofile全体の再検査ではない |
| MCP | `stale_runtime=false`、`delivery_info=mismatch` | Git checkout後の改行変換でsource byte fingerprintが変わった。バイナリ破損を意味しない。本レビュー文書追加後もsource完全一致は主張しない |
| 公開Release | latestは2026-08-26のv0.6.0。公開installerと最新本番receiptのinstaller hashは異なる | 最新main、手元の本番、公開ダウンロードは同一ではない |
| 計画check | `npm run check:current-decision` PASS | 見出しと入口pointerの検査であり、Next本文の時点整合は検証しない |
| 依存関係 | `npm audit --json` FAIL、影響4 packages（High 2 / Moderate 2）、GitHubのopen advisory 9件 | package数とadvisory数は異なる。到達可能な攻撃経路が確認された件数ではない |

## 優先して扱う指摘

### 1. P1: 公開対象外のlocalファイルが、次の一括stageでも拾える

前回の公開では、rootの生成bundle 2件とVault本文を含む資料を手動で除外した。bundleの一つには認証情報の形を持つ値が確認されている。今回は内容を再表示せず、対象が未追跡で、`.gitignore`による保護もないことを確認した。**今回のGitHub流出を確認したわけではない。** 次の`git add -A`で同じ除外を忘れると公開対象へ入る。

最小の対処候補は、確認済みの非公開生成物・資料の除外を永続化し、stage結果に含まれないことを検証すること。全`.agent`や全`.workflow`を一律除外せず、公開する実装証拠を維持する。根拠: [現在の除外](../../.gitignore)、Git status、`git check-ignore`の非一致、前回GitHub実施記録。

### 2. P1: 修正版のある推移依存3件が未反映

| package | 現行 | 更新候補と範囲 |
|---|---|---|
| fast-uri | 3.1.5 | Dependabot #9の3.1.7。MCP SDK → ajv経由。High |
| qs | 6.15.3 | Dependabot #11の6.16.0。MCP SDK → Express / body-parser経由。Moderate |
| @xmldom/xmldom | 0.8.13 | Dependabot #10の0.8.15。electron-builder → plist経由、開発依存。Moderate |

現在のMCP入口はstdioであり、Expressの存在だけで外部公開されたHTTP攻撃経路があるとは判断しない。各更新のlockfile差分と既存gateを確認する保守候補とする。自動更新やPR mergeはこのレビューでは実施しない。根拠: [lockfile](../../package-lock.json)、`npm ls`、今回のnpm audit、[Dependabot PR一覧](https://github.com/imonoonoko/TSUZUNE/pulls?q=is%3Apr+is%3Aopen+author%3Aapp%2Fdependabot)。

残る`moment@2.29.1`のHighは、固定Calendar互換性のため既に採用された残存リスクで、新規未審査の3件と分ける。[既存の採用境界](../../.agent/requirements/20260829-0603-calendar-plugin-compatibility/8_evidence_packet.md)は、固定artifact・sandbox・限定bridge、remote入力やNode側利用などへ広げた際の再評価を明記している。版だけを無断変更すると互換性契約を変えるため、同じ更新作業に混ぜない。

### 3. P2: 「現在のNext」に完了済みの状態が残っている

[PLAN.mdのCurrent Decision](../../PLAN.md#current-decision)はP0-5、1124 tests、本番反映は別判断という説明をNextへ残す一方、冒頭とVault campaignはP0-7完了まで進んでいる。互換性台帳にもPropertiesのinstalled未確認表記が残る。別の実行者がNextだけを読むと、終了済みの導入を再提案しうる。

gate前に固定した証拠文書へgate後の結果を追記しない運用自体は正しい。問題は、現在の判断欄と時点付きの証拠の区別が曖昧なこと。最小の候補は、可変の現在欄を一度整合し、過去のtest数や当時の未実施を履歴として保持すること。本レビューを根拠に次の機能を採用することはしない。

### 4. P2: 本番sourceのbyte一致とGit checkoutが衝突している

前回Git統合後、481 pathsのraw hashが変わり、production receiptとのdelivery比較はmismatchとなった。Git treeは検証済みcommitと同じだが、Gitが保持する正規化済み内容だけでは、元の混在改行を含む全byteを再構成できなかった。現在の[snapshot処理](../../scripts/source-fingerprint.mjs)は未追跡を含むsourceのbyteをhashするため、この不一致検出は契約どおりである。

次回本番更新の前に、改行方針と検証対象を確定し、必要ならcheckout前の正確なsource snapshotまたはpath/hash証拠を保持する。hash比較を緩めたり、未追跡を一律無視したりしてmatchへ見せる対処は採らない。公開Releaseも最新本番とは異なるため、利用者向けREADMEの実装一覧とダウンロード版の違いを明確にする価値がある。新版公開は別の作業判断。

### 5. P2・低頻度: Clipの同じIDを別内容で再利用すると前の保存結果を返す

[browser-clip-bridge.ts](../../src/main/browser-clip-bridge.ts)の201〜229行では、完了済みと処理中の照合が`requestId`だけで、payloadの一致を確認しない。認証済みclientが同じIDで別内容を送ると、その内容は保存されず、先行保存の結果をHTTP 200で返す。

現行拡張は`crypto.randomUUID()`で毎回IDを作るため、通常操作の偶発衝突は極めて起きにくい。既存testは同じpayloadの再送を確認する。最小の修正候補は、同じIDと異なる正規化payloadの組合せを409にし、完了済み・処理中の両方をfocused testで確認すること。独立読取レビューと親の経路確認による指摘で、この異常入力を今回実行再現したものではない。

## 製品としての評価と次の判断

強い点は、Markdown原典と人間の採否を中心に置き、revision競合、保護領域、非破壊編集を実装の境界にしていること。本番binaryを隔離データで検証し、利用者profileの不変性まで受入に含めた証拠もある。これらは機能一覧より重要な土台である。

次の保守区切りは、指摘1の公開対象保護 → 指摘2の3依存更新 → 指摘3・4の現在状態とdelivery手順整合を推奨する。これは提案であり、実装開始の承認ではない。その後の機能選択は、採用済みの順序「データ非破壊 → 毎日の操作 → 構造表現 → 選択済み拡張」に沿って具体的な日常操作1件へ絞る。

LIFE Weatherは「知的財産が芸術になる」という採用済みの製品価値であり、不要な装飾とは扱わない。現在の隔離試作と、利用者の美的・音楽反応評価、製品統合、本番反映を分ける。汎用plugin runtime、新DB、daemon、Hook、全Vault ingestionはこの監査を理由に再開しない。

| 区分 | レビュー後の整理 |
|---|---|
| 完了 | P0-7の本番受入、GitHub main統合、今回の状態照合・限定コードレビュー |
| 次の一手（提案） | 公開対象保護・3推移依存更新・現在欄とdelivery整合の小さな保守区切り。採用は工房主判断 |
| Held | 既存の未採用runtime・DB・Hook等。レビューだけで再開しない |
| Research / 利用者評価 | 日常の検索・再開・知識再利用の実効性、LIFE Weather隔離試作の体験。テスト件数では利用者価値を代替しない |

## 保存・検証記録

- 今回: `check:current-decision` PASS、npm audit FAILを分類、installed EXE / app.asar hash一致、Git・MCP・公開Releaseの境界確認。
- 再利用した直前の証拠: `work/github-delivery-20260906/{typecheck,tests,mcp}.log`、最新production receipt、既存Vault campaign。`work/`とreceiptはlocal証拠であり、clone先への同梱を保証しない。
- 今回のlocal audit JSON: `work/project-review-20260906/npm-audit.json`。秘密値やVault本文を本報告へ複製しない。
- 使用Skill: project-closeout、TSUZUNE同期のtsuzune / tsuzune-execution-record。独立source reviewはponytail-review。独立Agent: gpt-5.6-sol / high。親は現在taskの選択モデルを使用し、推定costは記録しない。
- 成果物は本報告とdocs INDEX、Vaultの実施記録・project入口・roadmap。文書のみの区切りなので再インストールを行わない。Gitへの追加公開も行わない。
