# CP0-T02 Implementation Brief

1. 既存2 capture scriptへ、case slugとqueryを環境変数で明示する比較modeを追加する。
2. 通常検索の固定node断言は通常modeに残し、比較modeではnode集合を生データとして記録する。
3. query matrixの各caseについてObsidian、TSUZUNEの順にcaptureする。
4. observation JSONから比較JSONと短いreportを作る。
5. 差がなければparserを触らない。差が局所ならtestを先に追加して最小修正する。
