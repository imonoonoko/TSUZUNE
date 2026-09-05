# Packet C: TSUZUNE placement

- Objective: LIFE WeatherをTSUZUNEにどう表示・起動・退出させると、道具UIに潰されず知識世界へ戻れるかを設計する。
- Sources: current App/ObservatoryView/styles、main/preload/shared contracts、plan/status/docs、現行prototype。
- Ownership: `results/C-tsuzune-placement.md`のみ。
- Do: current call path、data transport、配置候補（tab、immersive mode、別window等）、操作、accessibility、failure/fallback、installed-runtime境界を比較する。
- Do not: 製品配線、Electron設定、dependency、TSUZUNE、Gitを変更しない。
- Expected output: current truth、placement matrix、推奨境界、最小integration seam、未確認事項。
- Verification: source pathとcall siteを示し、歴史資料をcurrent truthにしない。

