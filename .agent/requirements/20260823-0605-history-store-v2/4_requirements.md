# TSUZUNE History Store v2 Requirements

## 1. Overview

TSUZUNE History Store v2は、現在ノートのMarkdown正本性を維持しながら、更新前のexact bytesを圧縮したimmutable intentと、適用後read-backを証明するcommit receiptで保持する。履歴は検証に成功した場合だけ復元結果として扱う。deltaとpackはPhase 1に含めない。

## 2. User Stories

- 利用者として、過去の任意更新前後の本文を完全に復元したい。
- 利用者として、履歴の一部が壊れた場合に誤った本文を復元結果として表示してほしくない。
- 利用者として、現在ノートを履歴storeなしでも通常のMarkdownとして読みたい。
- 利用者として、GitHubやcloud serviceなしでローカル運用したい。

## 3. Acceptance Criteria

### Exact restoration

- Given 有効なintent、when previous stateを復元する、then exact bytes、size、SHA-256が元fileに一致する。
- Given 日本語、emoji、CRLF、LF、空本文、when 記録して復元する、then文字・改行を含めbyte-exactに一致する。

### Commit classification

- Given intentだけが存在する、then状態はunapplied/uncertainでありcommittedとして扱わない。
- Given intentと対応receiptとcanonical after bytesが一致する、thencommittedと判定する。
- Given receiptが別intent、別transaction、別after hashを指す、then検証を拒否する。

### Integrity

- Given payload、before hash、after hash、transaction、targetのいずれかが不正、when verifyまたはrestoreする、then復元を拒否し破損箇所を特定する。
- Given unsupported schema、oversized展開結果、truncated payload、then fail closedする。

### Safety boundary

- Given Phase 1 test、when codecを実行する、thenproduction Vault、既存履歴、現在ノートを変更しない。
- Given unsupported record version、then推測変換せず明示的に拒否する。

## 4. User-Facing Nonfunctional Requirements

### Reliability

- 検証不能なchainからbest-effort本文を返さない。
- 一recordの破損範囲を一更新に局所化する。

### Portability

- GitHub、Git repository、外部DB、cloud APIを必須にしない。
- packの仕様versionを明示する。

### Feedback And Errors

- errorはtarget、sequence、失敗種別を含み、hash mismatchとchain breakを区別する。

## 5. Interaction Flow

```text
update request
  -> current UTF-8 bytes + proposed UTF-8 bytes
  -> immutable compressed intent
  -> canonical save (future phase)
  -> exact-byte read-back (future phase)
  -> immutable commit receipt
  -> intent/receipt verification
  -> Phase 1 ends before production write
```

## 6. Open Questions

- production writer接続時に、history commitとnote saveをどのpending/finalize protocolで整合させるか。
- immutable recordsをOneDrive配下に置くか、Vault外local storeに置くか。
- legacy履歴を永続保持するか、検証可能分だけ移行するか。
