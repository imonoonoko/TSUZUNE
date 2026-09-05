# Packet 07 — Acceptance Adversary

- Objective: 初回headless PASSが見逃した三画面の失敗を、再発時にFAILにできる受入契約へ変える。
- Context: transform文字列一致とscene遷移だけでは鑑賞品質を証明できなかった。
- Files / sources: acceptance-result.json、run-observatory-acceptance.mjs、observatory-view.test.tsx、observatory.test.ts、利用者提供画面。
- Ownership: read-onlyの検証設計。product source、test、TSUZUNEを編集しない。
- Do: 自動化可能な構図・密度・viewport安全領域・edge scope・caption制約と、主観に残す項目を分離する。
- Do not: 主観的な美しさを自動PASSと呼ばない。実装しない。
- Expected output: red testの順序、acceptance metrics、unseen checks。
- Verification: 初回実装が確実にFAILする条件を少なくとも三つ示す。
