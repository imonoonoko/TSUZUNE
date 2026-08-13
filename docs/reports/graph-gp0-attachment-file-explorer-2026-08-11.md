# GP0-3b-p — Attachment File Explorer Reveal

## 判定

`blocked`。固定参照の対象クリックと意味分類は成立したが、受入ゲートの同一process Graph再表示比較が成立しなかったため、TSUZUNE製品実装・比較parity claim・本番更新は行わない。

## 固定条件

- Reference: Obsidian Desktop 1.13.4
- Fixture: `fixtures/obsidian-graph-parity-vault`
- Target: `attachments/diagram.svg`
- Scope: Global Graph、空のquery、attachments表示、offscreen 1265×768、DPR 1、light theme
- Installer SHA-256: `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0`
- `app.asar` SHA-256: `51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`

## 観測結果

| 確認 | 結果 |
|---|---|
| exact menu label / order / enabled | PASS — `ファイルエクスプローラでファイルを表示` |
| classification | PASS — internal File Explorer (`internalPlugins.file-explorer.revealInFolder`) |
| request | PASS — `attachments/diagram.svg` を1回 |
| OS/external boundary | PASS — `window.open` と `shell.showItemInFolder` は0回、実OS起動なし |
| menu close / File Explorer state | PASS — menu close、File Explorer pane active、対象行 selected |
| action前後の query / camera / node / edge | PASS |
| Graph再表示の request no-replay | PASS — internal call count は1回のまま |
| Graph再表示の query / node / edge / leaf / tabs | PASS |
| Graph再表示の camera 完全一致 | **FAIL** |
| hooks / fixture / Vault / protocol | PASS — restore、digest不変、protocol復元 |

唯一の不一致は、context menuを安定して開くために harness が対象nodeを中央へ寄せた action前 camera と、Graph close/reopen 後に Obsidian が既定中央へ戻した camera の差である。

```text
action baseline: panX=715.5051116943359, panY=489.482177734375
Graph reopen:    panX=460.5,              panY=345
```

この差は対象menu actionの外部境界やVault変更ではないが、現行 GP0-3b-p R4／assertion が要求する「Graph再表示後もcamera完全一致」を満たさない。カメラ要件を緩和した再判定や再試行は、このレポートの範囲外であり、明示的な再開判断が必要である。

## 証拠境界

診断用の構造化観測とスクリーンショットは [assets/graph-gp0-attachment-file-explorer](assets/graph-gp0-attachment-file-explorer/) に保存した。`manifest.json` は `status: failed` であり、受入済みpacketではない。

証明していないもの:

- Windows Explorer／他OS file manager の実起動・表示・選択
- 物理マウス／キーボード、画面上の可視操作
- screen reader、High Contrast、multi-DPI、pixel identity
- 別process再起動時の動作
- TSUZUNE側の対応実装または parity

## 結論

Obsidian側の意味は internal File Explorer reveal と確定した。しかし、現行受入契約のcamera gateが未成立なので GP0-3b-p は `blocked` として閉じる。製品source、production Vault、production installation は変更していない。
