# Packet: Independent Verification

- objective: 第一P0実装をbaseline revisionと対象主語つきでdefect-first検証する。
- owner: 検証員。
- ownership: read-only。親が後で指定するchanged files、focused tests、関連fixture。
- forbidden: file edit、TSUZUNE write、Git operation、production update、既存失敗の修正。
- output: PASS/FAIL、再現command、observed output、unseen boundary、残る未確認事項。
- acceptance: 実装testとは異なる境界を一件以上実行し、保存／再起動が対象なら両方を含める。
- stop: baseline不一致、対象外failure、破壊的fixtureが必要なら実行せず親へ戻す。

## Result — 2026-09-05

- subject: current dirty working treeのP0-1 Excluded Files Presentation Contract。
- verifier: `VERIFY-01`、Luna / low、read-only。code、Vault、Git、productionを変更していない。
- first run: 指定8-file commandはNode既定heap約4 GiBでOOMし、product assertionまで完走しなかった。
- controlled rerun: `NODE_OPTIONS=--max-old-space-size=8192`で8 files / 243 tests PASS、23.39秒。
- unseen boundary: matcherが対象を持たない時はGraph objectをそのまま返す。excluded sourceだけが持つunresolved／tag派生nodeは除去し、visible sourceの`Missing Note`／tagは保持する。MCPは引き続きfiltered scanを使う。
- verdict: source-level PASS。
- not proven: 実GUI操作、Graph視覚完全一致、未収録pattern、installed runtime。
