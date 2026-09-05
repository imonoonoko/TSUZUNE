# Canonical plan: Obsidian級Daily Workspace continuation

既存の目的・scope・requirementsを継承し、2026-08-27に利用者が明示選択した上部シェル・設定追随campaignを実行する。machine-readableなpacket状態は`state.json`、分担境界は`orchestration.md`を正本とする。

1. 現行header、設定、更新、同期、Vault切替の実行経路と回帰testをread-onlyで確定する。
2. Obsidianの現行一次資料と既存reference evidenceから、Ribbon、Settings、Vault、statusの責務を抽出する。
3. 上部を静かなworkspace chromeへ再構成し、既存設定をcategory navigation型へ再編する最小の公開挙動をtestで固定する。
4. 既存handlerと保存契約だけを再利用して実装し、1440／900／720 CSS px、keyboard、focus、dialog、更新・同期・Vault操作を隔離環境で検証する。
5. production update、再起動後delivery確認、TSUZUNE final-boundary writebackまで行う。

成功条件は、主要操作への到達性を落とさず上部の圧迫が解消されること、設定がカテゴリ別に迷わず利用できること、全幅・keyboard・本番受入が通ること。新規dependency、DB、plugin system、account、cloud追加、Markdown正本変更、Git公開は行わない。

停止条件は成功条件の達成、または既存データ契約を広げる設計変更、利用者プロフィールを変更する実機操作、別途承認が必要な外部公開が必要になった時とする。
