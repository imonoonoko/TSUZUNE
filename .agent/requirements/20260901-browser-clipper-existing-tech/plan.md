# Browser Clipper Existing-Tech Enhancement Plan

## Task Contract

- objective: Proven browser-clipping technologyを活用し、TSUZUNE Browser Clipperを、1〜3クリックのまま通常Web本文とYouTube文字起こしをより確実に`01_受信箱`へ保存できる状態へ強化する。
- deliverables:
  - 現行技術候補・license・privacy・権限・保守性の比較と採否
  - 通常Web本文抽出とYouTube captureの実装改善
  - 公開挙動の回帰test、実サイト比較、利用文書
  - 製品code変更時のproduction updateとinstalled一致証拠
- constraints:
  - personal, one-device, local Windows。cloud抽出、account、telemetry、外部AI API、paywall回避を加えない
  - Markdown正本、`01_受信箱` create-only、非上書き、既存loopback認証を維持する
  - `knowledge.md`、`50_履歴`、AI organizer、Hooks、scheduleを変更しない
  - browser権限を不用意に広げず、第三者codeはlicenseと更新方法を明示する
  - Ponytailを使用しない
  - dirty worktreeの無関係差分を戻さず、task-owned filesだけを変更する
- success:
  1. 一般記事でnavigation/UI混入を減らし、抽出失敗時は現在の表示DOM fallbackを維持する
  2. 字幕が存在する検証用YouTubeで文字起こしを取得し、字幕なし・読込失敗・`/live/`を偽成功させない
  3. focused test、typecheck、extension self-check、実サイトsmoke、production updateを通し、installed extensionがsourceと一致する
- lane: Orchestrated
- evidence: primary-source comparison、red-green tests、isolated browser evidence、production receipt、TSUZUNE read-back
- stop: 外部service常用、広域host permission、credential取得、ライセンス不適合、第三者への公開が必要ならその候補を不採用にして契約内代替へ戻す。契約内代替でもsuccessを満たせない場合だけ利用者判断へ上げる。

## Decision pressure test

- strongest counterevidence: 現行の短いDOM extractorは通常記事では動作し、巨大なlibrary追加はbundle・review・更新負担を増やす。
- do nothing: PDF、iframe、YouTube字幕、SPA品質の既知問題が残り、「受信箱へ適当に放り込む」体験を損なう。
- smallest reversible alternative: proven extractorをfallback付きで1段追加し、YouTubeは一つのローカル取得経路と明示状態だけを加える。PDF・iframe・AI分類は同時に扱わない。

## Workstreams

1. Web extraction: Readability、Defuddle、MarkDownload／Obsidian Web Clipperの実装・license・bundle適合性を比較する。
2. YouTube transcript: DOM、player response、caption track、既存open-source実装を比較し、利用規約・権限・失敗状態を含む最小経路を決める。
3. MV3 integration: scripting world、CSP、asset packaging、権限、local-only bridgeとの適合性を確認する。
4. Human-first review: 1〜3クリック、失敗の明示、過剰な設定・依存を避ける観点から採用案を反証する。
5. Root integration: TDD、実装、未提示境界、実サイト、production gate、TSUZUNE writebackを所有する。

## YouTube実動画補正

`qH0jNKhfidQ`では、ページ内に現在動画の字幕トラックが存在しても`/api/timedtext`のdirect／srv3／json3が空HTMLになった。形式違いの再試行は採用せず、ページ内三経路を先に保ったまま、取得不能または途中取得時だけTSUZUNE側で既存`yt-dlp`を一度実行する最小fallbackへ補正する。追加package、daemon、browser Cookie、PO Token provider、remote component、権限拡張は行わない。
