# Obsidian Graph Parity Requirements

## 1. Overview
TSUZUNEのGraph viewを、Obsidian公式Graph view／Local Graphと同じ知識探索を行える画面へ段階的に更新する。GP1では力学配置と4つのForce設定を完成させる。

## 2. User Stories
- 個人利用者として、リンク構造に応じて自然にまとまるグラフを見たい。
- 個人利用者として、中心力、反発力、リンク力、リンク距離を調整したい。
- 個人利用者として、好みの設定を再起動後も使いたい。
- キーボード利用者として、既存のノード移動と強調を失いたくない。

## 3. Acceptance Criteria

### Force settings
- Given グラフ設定を開いた状態, when 4つのsliderを変更する, then 対応する設定値と配置が更新される。
- Given 設定を変更済み, when 初期設定に戻す, then 4項目が既定値へ戻る。

### Persistence
- Given Force設定を変更した, when アプリを再起動する, then 同じ設定が復元される。
- Given 古い`settings.json`, when 読み込む, then Graph既定値を補いVault設定を維持する。

### Layout
- Given 同じnode集合と設定, when 力学配置を構築する, then 安定した再現可能な座標を返す。
- Given Link distanceを増やす, when 同じリンクグラフを再配置する, then 直接接続node間の距離が増える。
- Given Center forceを増やす, when 全体グラフを再配置する, then node集合が中心へ近づく。
- Given Repel forceを増やす, when 同じグラフを再配置する, then node間の平均距離が増える。
- Given Link forceを増やす, when 短いLink distanceで再配置する, then 接続nodeが目標距離へ近づく。
- Given Local Graph, when 配置する, then 現在ノートを中心へ固定する。Given Vault全体Graph, then 現在ノートを固定しない。

### Safety
- Given Graphを操作する, when Force設定を変更する, then Markdown本文、リンク、選択ノートを変更しない。

## 4. User-Facing Nonfunctional Requirements

### Responsiveness
- 現行上限50 node／200 edgeでslider操作後に長時間入力不能にならない。

### Usability
- 設定名はObsidian公式名称に対応する日本語を使い、初期設定へ戻せる。

### Accessibility
- sliderに一意なlabelを付け、button node、focus強調、色以外の関係説明を維持する。

### Feedback And Errors
- 設定保存失敗時はGraph表示を続け、利用者へ保存失敗を通知する。

## 5. Open Questions
- sliderの厳密な範囲はObsidian実機比較後に確定する。
- Canvasへ移した後のscreen reader node表現はアクセシブルDOM層で維持する。
