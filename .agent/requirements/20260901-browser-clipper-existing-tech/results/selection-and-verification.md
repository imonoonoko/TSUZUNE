# Existing Technology Selection and Source Verification

この文書はproduction gate前のsource判断と検証を固定する。installed deliveryの正本は`docs/reports/production-update-latest.json`であり、この文書へ本番状態を複製しない。

## 採用

- 一般Web: Mozilla Readability 0.6.0をApache-2.0 licenseとともに拡張へローカル同梱する。記事として成立しない場合だけ既存の表示DOM抽出へ戻す。
- YouTube: Defuddleの現行実装を参考に、可視文字起こし、パネル展開、ページ内`ytInitialPlayerResponse`の検証済みcaption trackを先に使う。この三経路で取れない場合だけ、アプリ側で既存`yt-dlp`を一度実行する。Defuddle本体と`yt-dlp` binaryは同梱しない。
- MV3: `activeTab`、`scripting`、`storage`と既存loopback hostだけを維持する。CDN、remote code、全サイト常時権限、YouTube Data API、Innertube、cloud transcriptionを追加しない。
- UX: 保存操作と設定を増やさず、YouTubeは`captured`、`unavailable`、`failed`を区別する。字幕の存在と取得成功を混同しない。

## 反証から追加した境界

- caption responseはHTTPSのYouTube `/api/timedtext`かつ現在動画ID一致に限定し、512 KiBで打ち切る。
- SPAの古いplayer responseを現在動画へ流用せず、`videoDetails.videoId`またはmicroformatのexternal video IDで照合する。
- 不正・負のtimestampを捨て、channel、本文、行数、待機時間をboundedにする。
- `unavailable`は「クリップ時点に手掛かりを確認できなかった」とし、字幕不存在の断定に使わない。

## Source verification

- focused capture／popup／backend tests: 24件PASS。
- typecheck、Browser Clipper self-check、MCP check: PASS。
- full test filesを分割実行: 97 files、899 passed、1 skipped。
- production test: Node heapを10 GiBに設定して97 files、899 passed、1 skipped。
- live article: MDN本文18,000文字をReadabilityで取得し、synthetic navigationを除外。
- live YouTube: TED動画`arj7oStGLkU`で画面上の文字起こし8,000文字を`captured/page`として取得。
- real MV3 file injection: unpacked Chromium extension contextから`chrome.scripting.executeScript({files: ['vendor/Readability.js', 'capture.js']})`を実行し、非同期のplain object結果を確認した。自動試験だけのhost許可を加えた複製でfile injection境界を検査し、本番manifestには追加していない。実際のtoolbar user gestureによる`activeTab`付与は利用者確認の境界として残す。

## Delegated review

- Web extractor調査: Readability採用、fallback維持、license同梱を推奨し採用。
- YouTube selector監査: microformat ID fallback、timestamp検証、stale response優先順位を指摘し修正。
- MV3監査: 権限不変とlocal bundleを確認し、実Chromeのasync file resultを未提示境界として提示。test-only unpacked extensionで追加検証。
- Human-first／adversarial review: 追加設定を拒否し、三状態、response上限、channel上限、正確な文言を採用。PDF、iframe、権限拡張は契約外として不採用。

## YouTube local fallback delta

- 実失敗動画`qH0jNKhfidQ`では、同じcaption URLのdirect／srv3／json3がすべて空HTMLだったため、形式再試行案を不採用にした。
- `yt-dlp 2026.08.19`のJSON3字幕取得をapp-side fallbackとして採用。動画IDを検証して固定watch URLをshellなしの引数配列で渡し、20秒、2 MiB input、48 KiB transcript、cue境界で制限する。
- `--ignore-config`で利用者・system設定を読み込まず、Cookie、PO Token provider、remote componentを使わない。後順位言語が429等で失敗しても、先に保存済みの優先字幕が有効なら利用する。
- 同動画のlive smokeは`ja-orig`、493行、15,048文字、切捨てなし。先頭`0:00 最近さ、AI`から末尾`22:07 が`まで取得した。
- 関連6 test filesは48 PASS。typecheck、Browser Clipper self-check、全体97 files／916 PASS／1 SKIP、MCP checkはPASS。
- 独立adversarial reviewは、`yt-dlp`設定の暗黙読込をP1として指摘。`--ignore-config`と回帰testを追加後、実動画で再検証した。

## Primary sources

- Mozilla Readability: https://github.com/mozilla/readability
- Defuddle YouTube extractor: https://github.com/kepano/defuddle/blob/197db78742ad0fb91100c2b478f5350ee9d8702c/src/extractors/youtube.ts
- Chrome scripting: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chrome activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- YouTube captions download: https://developers.google.com/youtube/v3/docs/captions/download
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
