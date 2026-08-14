# ChatGPT Candidate Eligibility Hardening C1-C

実施日: 2026-08-09（JST）

## 結論

C1-Bで確認した貼付AI回答、コード、単発依頼、創作prompt、瞬間的状態を、出典を失わずプロフィール自動適用経路から分離しました。健康、移動制約、金融、関係性、個人アカウントは本文からprivacy reviewへ送ります。

既知57件の回帰では、誤検出またはactive memoryへ安全でない候補が自動適用へ残った件数は0です。一方、強化後の自動適用候補は7件しかなく、全件reviewで安全と判定したものの、ruleごとの最低10件というgateを満たしません。合格ruleは0件で、C1-D Vault Applyへは進みません。

## 測定

- 候補: 799件
- source reference: 863件
- C0-A messageへ追跡成功: 863/863件、100%
- assistant role、old branch、internal contentの構造的混入: 0件
- `auto_apply_candidate`: 7件
- `human_review`: 406件
- `excluded_from_profile`: 386件
- 本文由来を含むprivacy review: 169件
- privacy、past、correction、unconfirmedの自動active化: 0件
- C1-Bの旧候補ID: 793/793件を維持
- C1-B固定review: 57/57件を再照合、既知false positiveの自動適用0件、既知unsafeの自動適用0件

| Rule | Active memoryへ安全 | Review数 | Precision | Gate |
|---|---:|---:|---:|---|
| `profile.explicit_self_statement` | 2 | 2 | 100% | HOLD: 10件未満 |
| `preference.explicit_expression` | 7 | 7 | 100% | HOLD: 10件未満 |
| `life.explicit_consideration` | 0 | 0 | - | HOLD: 10件未満 |

同じ候補が複数ruleに該当するため、rule別review数の合計は自動候補数と一致しません。

## 実装境界

- 候補へ`auto_apply_candidate`、`human_review`、`excluded_from_profile`と判定理由を付与する。
- 候補IDと全source referenceは保持し、除外した本文を原典索引から削除しない。
- 明示的な一人称プロフィール、反復・長期性が示された好み、明確な好き嫌いだけを自動候補へ残す。
- 文脈依存、最近・今日などの時間限定、過去、訂正、不確実な内容は人間確認へ送る。
- 個人本文、候補ID、review表は`work/`だけに保存し、Gitや本番Vaultへ含めない。

## 判定

C1-Cの安全回帰はPASSです。ただし自動適用ruleの精度gateはサンプル数不足でHOLDです。人物プロフィール5ノートへのwriteは0件を維持し、Graph Parityの次sliceへ戻ります。
