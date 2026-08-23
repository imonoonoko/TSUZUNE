# Alternatives

## A. 現行UIとMCPを個別に拡張する

- 良い点: 各差分は小さい。
- 問題: UIはアプリIPC、MCPはVault直接操作となり、Drive台帳、監査、同時実行制御が分裂する。現行でもフォルダ移動時の配下MarkdownがDrive台帳へ記録されない。
- 判断: 不採用。常用で最も危険なのは機能不足より、入口ごとに結果が違うことである。

## B. 起動中アプリへ移動実行を集約する（採用）

既存ファイルツリーを維持し、`list_directory`、既存`create_directory`、`preflight_move_entry`、`move_entry`を公開する。移動のpreflightとapplyは、UIもMCPも起動中のTSUZUNE本体にある同一コーディネータを通す。

- 良い点: filesystem、Drive台帳、AI監査、アプリ状態を一つの直列化された経路で扱える。
- 良い点: 既存の認証付きloopback bridgeを一般化して再利用でき、新しい常駐サービスやDBが不要。
- 代償: AI移動にはTSUZUNE本体の起動が必要。これはDrive一貫性を壊す直接実行fallbackより安全で、エラーも明確である。

## C. 例外時rollbackだけで済ませる

- 良い点: 実装が最小。
- 問題: filesystem rename後のプロセスクラッシュや電源断ではcatchが動かず、Drive台帳と監査がずれる。
- 判断: 不採用。一件だけ保持する小さなoperation journalを使う。汎用transaction frameworkや履歴DBは作らない。

## D. preview/apply式の一括整理エンジンを作る

- 良い点: 大規模な初回整理には強い。
- 問題: 分類規則、所有権、部分成功、rollback、レビューUIが急増する。
- 判断: 不採用。反復利用で単一操作が明確な摩擦になった時だけ再評価する。

## E. フォルダごとのAI権限設定を作る

- 良い点: 組織利用では柔軟。
- 問題: 個人一台利用では設定負担が大きく、本文変更と配置変更を混同する。
- 判断: 不採用。`50_履歴`固定、`40_情報源`本文保護という少数の役割別契約に留める。
