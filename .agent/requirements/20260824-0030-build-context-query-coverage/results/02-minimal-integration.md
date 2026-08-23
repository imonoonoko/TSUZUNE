# Packet 02 result

## Accepted

- projection triggerをseed単体長から全candidateの実効bundle overflowへ変更。
- punctuation原文phraseと正規化した分割語を併用。
- 明示intent winnerを固定件数で打ち切らず、fallbackはintent集約時の最大3branchだけに限定。
- bodyless parentだけ配下branchを展開し、direct bodyを持つ親は子階層を不必要に展開しない。
- selected ancestor/descendantの重複を除外。

## Rejected

- 固定上限を3から4へ変えるだけの修正。
- 全parent branchの無条件展開。
- atomic queryでも3 sectionを埋める旧fallback。
- 新規parser、dependency、DB、cache。

## Verification

- context suite 47/47 PASS。
- typecheck PASS。
- progressive-context fixtureは一度expected source欠落を再現後、atomic fallbackを除去してPASS。
