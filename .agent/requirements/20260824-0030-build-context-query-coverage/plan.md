# Canonical plan

`state.json`をmachine-readableな状態正本とし、このfileをhuman-readableな実行順の正本とする。`1_purpose.md`と`2_requirements.md`は契約根拠、`packets/`は実行指示、`results/`は結果証拠である。

1. 3つの既知残余と作業中に発見したatomic-query予算浪費をpublic testでREDにする。
2. `src/core/context.ts`の既存projection経路だけを変更し、4 fixtureと既存context suiteをGREENにする。
3. MCP公開説明を実装契約へ合わせ、full repository gateとprogressive-context fixtureを通す。
4. production updateを実行し、再起動後の本番MCPで5ケースを3000/5000/8000文字に対して検証する。
5. latency、receipt、品質結果を確定し、TSUZUNE実施記録へfinal-boundaryで一度だけ保存する。

停止条件はTask Contractのsuccess達成、または既存のデータ保全・MCP安全契約を広げる必要が判明した時とする。
