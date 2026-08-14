# AI Write Review Mode Requirements

## 1. Overview

Review modeは、利用者が指定したpathへのAI書込みを一旦proposalとして保留し、TSUZUNE appで内容を確認した後だけVaultへ適用する機能である。Review対象外の通常ノートは現在の自律更新を維持する。

## 2. User Stories

- 利用者として、重要だがAI書込み禁止にはしたくないノートだけをReview対象にしたい。
- 利用者として、現在本文とAI提案を比較し、承認または取消したい。
- 利用者として、確認中に本文が変わったproposalを誤適用したくない。
- 利用者として、アプリ再起動後も未処理の提案を失いたくない。

## 3. Acceptance Criteria

### Policy selection

- Given Review対象が未設定、when既存MCP書込みを行う、then現在と同じ即時更新または既存host確認になる。
- Given同じpathがimmutableとreviewの両方に一致、whenMCP書込みを行う、thenimmutableとして拒否しproposalを作らない。
- Givenfolder pathをReview対象に設定、when配下noteへMCP書込みを行う、then直接更新せずproposalを作る。

### Proposal creation

- Given Review対象の既存note、when`update_note`または`autonomous_update_note`を呼ぶ、thenVault本文とAI履歴を変えずpending proposalを返す。
- Given Review対象の未作成path、when`create_note`を呼ぶ、thennoteを作らずcreate proposalを返す。
- Given同じcanonical pathにpending proposalがある、when別proposalを作ろうとする、then既存proposalを上書きせず拒否する。
- Given100,000文字超、invalid path、immutable path、stale expected revision、when proposalを要求する、thenproposal作成前に既存validationで拒否する。

### Review UI

- Givenpending proposalがある、when設定の「AI書き込み」sectionを開く、then対象path、operation、作成時刻、理由、出典、現在本文と提案本文の差を確認できる。
- Givenproposalを取消、when確認操作を完了する、thenproposalだけを削除しVaultとAI履歴を変えない。
- Givenproposalを承認、when適用条件が現在も有効、then提案どおり一回だけ適用しproposalを削除する。

### Conflict and safety

- Givenproposal作成後に対象本文が変わった、when承認する、then`FILE_CHANGED`として失効し、提案を適用しない。
- Givenproposal作成後に対象がimmutableになった、when承認する、then拒否してVaultを変えない。
- Givencreate proposal後に同じpathが作成された、when承認する、then失効し既存noteを上書きしない。
- Givenupdate proposalが成功、then旧本文、reason、source refs、previous revisionを既存AI履歴へ一回保存する。
- GivenappまたはMCPを再起動、thenpending proposalを再表示できる。

## 4. User-Facing Nonfunctional Requirements

### Responsiveness

- Settingsを開いた時だけproposal storeを読み、常時pollingしない。
- 承認／取消後は同じ画面内で結果を更新する。

### Usability

- Review対象は既存immutable設定と同じpath入力規則を使う。
- 既定は空で、日常の自律更新へ確認操作を追加しない。
- proposalの置換や自動適用を行わない。

### Accessibility

- dialog title、対象path、承認、取消、errorをaccessible nameで識別できる。
- keyboardだけでproposal選択、差分確認、承認、取消、dialog closeを行える。
- focusをdialog内に保持し、close後は起点へ戻す。
- 追加／削除の差を色だけで伝えない。

### Feedback And Errors

- MCPは`pending_review`とproposal IDを明示し、Vault未更新であることを返す。
- 競合、immutable化、store読書き失敗を区別して表示する。
- store破損時はfail closedとし、直接更新へfallbackしない。

## 5. Fixed Decisions

- proposal storeはsettings.jsonと同じapp userData配下の単一JSON file。
- proposalは自動期限切れにせず、承認・取消・競合失効まで保持する。
- 同一canonical pathのpendingは最大1件。新しい提案で上書きしない。
- Reviewはopt-in pathだけ。既定のReview対象は0件。
- 承認者はローカルTSUZUNE appを操作する一人の利用者。

## 6. Stop Conditions For Implementation

- appとMCPが同じproposal store pathを安全に解決できない。
- atomic writeと破損時fail-closedをNode標準機能で成立させられない。
- 既存write outputへpending状態を後方互換に追加できない。
- dirty差分と対象sourceの責任範囲を分離できない。
