# Daily Workspace Phase B 非干渉受入 — 2026-08-22

## 現在の判定

`SURROGATE-PASS / REAL-OS-SKIP`

B1（現在のWindows表示倍率）は実機PASS。B2の音声読み上げ確認は利用者判断で対象外とした。B3とB4は、利用者の画面・入力・Windows設定を変更しない隔離オフスクリーン検証がPASSした。ただし実Windows High Contrastと物理200%表示は実施していないため、元のPhase B全体を実機PASSとは扱わない。

## 対象と配信境界

- 実行対象: `C:\Users\Humin\AppData\Local\Programs\tsuzune\TSUZUNE.exe`
- executable SHA-256: `853173efd7c84ec20a1a1db62c256ab53ec8690b9ec45760af450b889a8462d3`
- installed `app.asar` SHA-256: `f272fe46a3262d9fd17764c5e2b2d734463b13dbff2b95f7c9b59255037254cd`
- 前回production receiptとのbinary一致: PASS
- 現在のWindows表示倍率: 100%（AppliedDPI 96）
- High Contrast: off（確認時）
- production Vault: `TSUZUNE-Starter-Vault`
- 非干渉fixture: `fixtures/obsidian-graph-parity-vault`の隔離コピー
- 非干渉実行: window非表示、座標`-32000,-32000`、taskbar非表示、専用userData、終了後の残留process `0`

インストール済みbinaryは前回のR5 production receiptと一致する。一方、現在のrepository source fingerprintはreceiptと一致しないため、本記録は「検証済みR5 installed binaryの挙動」を示すものであり、現在の作業ツリーとの等価性は示さない。製品コードは変更しておらず、`production:update`は不要である。

## Matrix

| ID | Result | Evidence |
|---|---|---|
| B1 | PASS | 100%表示・1266×793のTSUZUNEウィンドウで、主要ヘッダー、左右サイドバー、中央ペイン、FileTree footer、Quick Switcher、Command Palette、設定ダイアログ、workspace tabsを確認。重なりや到達不能な主要操作はなく、検索・起点ボタン・モーダル復帰先・FileTreeの現在選択とキーボードフォーカスが色以外の枠線・背景差を伴って視認できた。Quick Switcher / Command Palette / 設定はいずれもEscapeで閉じられた。 |
| B2 | EXCLUDED | UI Automationで名前・役割・モーダル境界まで確認済み。Narrator / NVDAの実音声確認は利用者判断で今回の受入対象から除外した。 |
| B3 | SURROGATE-PASS / REAL-OS-SKIP | Chromiumの`forced-colors: active`でcurrent tab、Quick Switcherのselected、keyboard focus、空状態primary action、disabled commandと理由をDOM・computed style・画像で確認。Windows High Contrastそのもの、error / conflict状態の強制色表示は未実測。 |
| B4 | SURROGATE-PASS / REAL-OS-SKIP | 非表示windowを720×768 logical px、`devicePixelRatio=2`で実行。左右sidebar展開、2 tabs、主要controls、Quick Switcherがviewport内に収まり、横overflowなし。Windows物理200% DPI、OS chrome、font rasterizationは未実測。 |

## B1で実施した操作

- `開く`からQuick Switcherを開き、検索欄、候補、`Enter 開く`、`Ctrl+Enter 新しいタブ`、`Esc 閉じる`を確認してEscapeで閉じた。
- `操作`からCommand Paletteを開き、検索欄、候補、shortcut表示、modal境界を確認してEscapeで閉じた。
- 設定を開き、`設定を閉じる`、ラベル付き設定欄、`キャンセル`、`設定を保存`への到達性を確認し、変更せずEscapeで閉じた。
- Quick Switcherの`Ctrl+Enter`で同一ノートを2つ目のworkspace tabとして開き、tablist / tab / close button / tabpanelを確認した。
- `Ctrl+Shift+Tab`でworkspace tabが切り替わり、視覚上のactive tabが移ることを確認した。
- FileTreeの現在ノートからArrowDownで隣接項目へキーボードフォーカスを移し、現在選択（teal背景）と移動先フォーカス（gray背景）が別状態として見えることを確認した。
- `Ctrl+Shift+F`で内容検索へ移動し、検索欄の明確なfocus outlineを確認した。

## 非干渉サロゲート証拠

- result: `docs/reports/assets/daily-workspace-phase-b-2026-08-22/phase-b-surrogate-result.json`
- capture: `docs/reports/assets/daily-workspace-phase-b-2026-08-22/b3-b4-surrogate.png`
- fixture fingerprint: 実行前後とも`96b2dc1d2c7884a7127ee4cf7e4a484ada2ff4cae7cacf2732de6570f5618021`、8 Markdown files
- installed executable SHA-256: `853173efd7c84ec20a1a1db62c256ab53ec8690b9ec45760af450b889a8462d3`

## 結論

ユーザー操作を邪魔しない範囲の受入は完了した。実OS設定の変更を伴うB3 / B4は意図的にSKIPし、サロゲート結果で置き換えない。将来、実Windows High Contrastまたは物理200% DPIを確認する場合だけ、利用者が明示的に再開する。
