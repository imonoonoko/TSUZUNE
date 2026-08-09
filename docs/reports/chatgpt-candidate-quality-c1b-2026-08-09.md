# ChatGPT Candidate Quality Calibration C1-B

実施日: 2026-08-09（JST）

## 結論

OpenAI公式ExportからC1-Aが抽出した793候補は、出典追跡と構造的なrole／branch分離には成功していますが、人物プロフィールへ自動適用できる精度には達していません。3つのruleをすべて本人確認候補へ降格し、Vaultへの自動writeは行いません。

## 測定

- 対象候補: 793件
- source reference: 857件
- C0-A messageへ追跡成功: 857/857件、100%
- assistant role、old branch、internal contentの構造的混入: 0件
- 層化sample: 57件
- review完了: 57/57件
- privacy、past、unconfirmed、correctionの自動active化: 0件

| Rule | Active memoryへ安全 | Review数 | Precision | 判定 |
|---|---:|---:|---:|---|
| `profile.explicit_self_statement` | 1 | 10 | 10.0% | HOLD |
| `preference.explicit_expression` | 3 | 11 | 27.3% | HOLD |
| `life.explicit_consideration` | 0 | 10 | 0.0% | HOLD |

合格条件は10件以上のreviewとprecision 90%以上です。合格ruleは0件でした。

## 主な誤検出

- ユーザー発言内へ貼られた過去のAI回答
- JSXやresource pathなどのコード断片
- 単発の質問、作業依頼、創作prompt、画像調整指示
- 一時的な体調・行動を持続する現在プロフィールとして扱う候補
- 健康、移動制約、金融、関係性を機微情報として止められない候補

## 次の処置

C1-Cで引用AI回答、コード、単発依頼、創作promptを候補から分離し、本文由来の機微性判定を加えます。同じ層化sampleを回帰証拠にし、90% gateを満たすまで人物プロフィールへの自動適用へ進みません。

個人本文、candidate ID、判定表は`work/`だけに保存し、この公開reportやGitへ含めていません。
