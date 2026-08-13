# CP0-T02 Discussion Log

- 2026-08-12: CP0-T01はObsidianのmalformed-query固定参照がなく、parityを推測できないためblockedだった。
- 2026-08-12: ユーザーの「はい」を、固定参照captureを次taskとして開始する承認と解釈した。
- 2026-08-12: 既存captureには通常queryのnode固定断言があるため、比較modeではquery/persistence/stabilityだけを断言し、node集合とerror表示は比較対象として記録する。
- 2026-08-12: 固定7件を取得。query lifecycleとerror表示は7/7一致。compile-invalid regexはTSUZUNEだけ0件だったため、`SyntaxError`だけfail-openへ修正した。
- 2026-08-12: 修正後は実在note集合が7/7一致。raw node集合には未解決linkの保持・ID差が5件残り、別責務なのでこのtaskへ混ぜず`different`で完了する。
