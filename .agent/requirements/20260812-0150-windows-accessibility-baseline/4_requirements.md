# Windows Accessibility Baseline Requirements

## 1. Overview

このsliceは新しいaccessibility機能を実装するものではない。Graph primary flowが実Windowsで利用可能かを測定し、DOM上の回帰と実OS受入を混同しないためのbaselineである。

## 2. User Stories

- As a keyboard user, I want Graphの操作とnodeをpointerなしで利用したい。
- As a magnified-display user, I want 200%でも主要操作へ到達したい。
- As a screen-reader or High Contrast user, I want 確認済みの支援範囲と未確認範囲が正確に分かることを望む。

## 3. Acceptance Criteria

### Keyboard Graph flow

- Given Graph view, when Tabを使う, then toolbar操作と各nodeへ順にfocusでき、focusは視認できる。
- Given focusされたGraph node, when Enterを押す, then 対応するnoteを開く。
- Given graph canvasへfocusした状態, when `+`、`-`、`0`、矢印、Shift+矢印を使う, then zoom/panの対応操作が行える。

### Display scale

- Given 720px幅相当のwindow, when Windows 100%と200%でGraph primary flowを操作する, then 上記の操作へ到達できるかを各倍率で記録する。
- Given 画面外へ出る操作がある, when その状態を観測する, then PASSにせずFAILまたはSKIPと理由を残す。

### Assistive technology

- Given screen readerまたはHigh Contrastを使用する, when Graph primary flowを確認する, then 実施した環境、観測内容、PASS／SKIP／FAILを記録する。
- Given DOM/JS testだけがある, when 結果を報告する, then 実Windows keyboard、screen reader、High Contrast、物理DPIのPASSとは表現しない。

## 4. User-Facing Nonfunctional Requirements

- Keyboard focusは色だけに依存せず、少なくとも現在の2px outlineと同等に視認できる。
- 各primary controlは意味のあるaccessible nameを持つ。
- 本sliceの測定はVault内容、通常のGraph挙動、MCP、production profileを変更しない。

## 5. Open Questions

- screen readerの受入対象をWindows Narratorだけにするか、NVDAも含めるか。
- 720px幅と200%を同時条件にするか、個別の最小表示条件として扱うか。
- UI AutomationによるGraph遷移が座標情報不足で確認できなかったため、実Graph flowの初回受入をどの手動capture手順で残すか。
