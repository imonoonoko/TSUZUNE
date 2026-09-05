# Windows本番運用ガイド

更新日: 2026-09-06

対象: 個人用Windows PC / 公開GitHubリポジトリ`imonoonoko/TSUZUNE`

## 現在の本番構成

- 配布形式: Windows x64 NSIS、ユーザー単位、one-click
- app ID: `jp.tsuzune.app`（更新互換性のため固定）
- インストール先: `%LOCALAPPDATA%\Programs\tsuzune`
- 本体設定: `%APPDATA%\TSUZUNE`
- Vault: 利用者が選んだ任意のローカルフォルダ
- 更新配信: 公開GitHub Releases
- Release作成認証: maintainerのGitHub CLI keyringまたは一時token。アプリ側の更新確認には認証不要

アンインストールや本体更新では、Vault、TSUZUNE設定、暗号化されたGoogle更新トークン、Drive同期台帳を削除しない。NSISの`deleteAppDataOnUninstall`も明示的に`false`としている。

## ローカル本番ビルド

Google標準ログインを組み込む場合だけ、ビルドプロセスへDesktop OAuth値を渡す。値をGit、Markdown、ログへ書かない。

```powershell
$env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID='Desktop OAuth client ID'
$env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET='Desktop OAuth client secret'
npm test
npm run check:mcp
npm run pack:win
npm run check:installer
npm run check:packaged
Remove-Item Env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID
Remove-Item Env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET
```

生成物:

- `dist/TSUZUNE-Setup-<version>.exe`
- `dist/TSUZUNE-Setup-<version>.exe.blockmap`
- `dist/latest.yml`
- `dist/win-unpacked/resources/app-update.yml`

`npm run check:installer`は、バージョン、ファイル名、SHA-512、blockmap、公開GitHub更新先に加え、実際の`app.asar`で`electron-updater`をCommonJS互換のdefault importとして読み込んでいることを検査する。`npm run check:packaged`は、パッケージ版を非表示で起動し、レンダラーの読み込み完了を一時ready fileで確認する。単なるプロセス生存は成功条件にしない。

## このPCへのインストール

開発中の検証済みworking treeを、このPCの本番TSUZUNEへ反映する正式経路は次の1コマンドとする。

```powershell
npm run production:update
```

このコマンドは順番に次を行う。

1. 本番TSUZUNEが終了していること、merge conflictがないこと、staged／unstagedの両方を含む`git diff --check HEAD`が通ることを確認する。
2. source treeと`%APPDATA%\TSUZUNE`のfingerprintを取得する。検証対象sourceは`work/production-source-*`へbyteを変えずコピーし、コピー先のfingerprintも照合する。
3. typecheck、2 workersの全テスト、MCP検査、NSIS生成、installer検査を行う。
4. 一時`--user-data-dir`でpackaged版を起動し、renderer-readyを確認する。
5. sourceが処理中に変化していない場合だけ、installerを`/S`で実行する。
6. installed版も一時profileで起動し、version、実行ファイル、`app.asar`をbuild成果物と照合する。
7. production profileが完全に不変であることを確認し、Codex MCP登録を現行tool一覧へ更新する。
8. 秘密値を含まないreceiptを`docs/reports/production-update-latest.json`へ保存する。

sourceのテキストcheckoutは`.gitattributes`でLFに統一する。これはrepositoryの方針であり、利用者Vault内のBOM・改行の保存契約は変更しない。本番更新前に関連するplan・status・workflow文書を確定し、更新中や成功後にfingerprint対象を編集しない。最新receiptの`sourceArchive.path`は検証したsourceの完全コピーを指すローカル証拠で、Git公開対象ではない。snapshotを削除するとbyte単位の復元証拠を失うため、対応する本番境界が必要な間は保持する。失敗したgateのarchiveも本番成功の証明にはしない。

Git checkout・commit・文書更新の後はsourceの完全一致を再確認する。mismatch時に比較を緩めたり、受入済みと表示したりしない。保存したarchiveとのpath／hash比較で差を特定し、必要な更新を通常gateで再検証する。archiveを現在のworktreeへ一括上書きする操作は行わず、未commit変更を保護する。

自動smokeはactive Vaultを開かない。本番TSUZUNEが起動中の場合も強制終了せず中止するため、利用者が保存して閉じた後に再実行する。

Google OAuth値は明示的なbuild環境変数を優先する。未指定時は、このPCのインストール済み個人用bundleに既に含まれる値をbuild子プロセスへだけ引き継ぐ。値は表示・report保存せず、一意に取得できなければinstall前に失敗する。

ローカルdogfoodでは同一SemVerの再インストールを許容し、build版とinstalled版の`app.asar` SHA-256完全一致を最新版の証拠とする。GitHub Releases経由で他のインストール版へ更新を配信する場合は、必ずversionを上げる。

通常はインストーラーをダブルクリックする。自動検証時は次を使える。

```powershell
Start-Process .\dist\TSUZUNE-Setup-0.5.0.exe -ArgumentList '/S' -Wait
```

インストール後は、Windowsの「インストールされているアプリ」に`TSUZUNE <version>`が登録される。スタートメニューとデスクトップにもショートカットを作る。

## 新しい更新を配信する

1. `package.json`と`package-lock.json`のversionを上げる。
2. テスト、MCP確認、本番ビルド、`check:installer`を通す。
3. 変更をcommitして公開GitHubへpushする。
4. 一時的にGitHub CLIのtokenを環境へ渡してReleaseを作る。

```powershell
$env:GH_TOKEN = gh auth token
npm run release:win
Remove-Item Env:GH_TOKEN
```

Releaseには最低限、`latest.yml`、installer、blockmapが必要。インストール済みTSUZUNEは起動5秒後またはヘッダーのボタン操作で最新版を確認する。tokenは更新providerの作成時だけ読み込み、その後もプロセス内にだけ保持し、TSUZUNEの設定ファイルへ保存しない。

## 更新適用時のデータ保護

1. 更新確認と取得は、ノートI/Oとは別のIPC経路で実行する。
2. 適用ボタンでは、まず編集中ノートの保存完了を待つ。
3. 保存失敗または外部変更競合があれば適用を中止する。
4. 保存成功後だけ終了ガードを解除し、`quitAndInstall`で再起動する。

Vaultと設定はインストール先の外にあるため、本体ファイルの置換に巻き込まれない。

インストール先の実物を確認する場合:

```powershell
npm run check:packaged -- "$env:LOCALAPPDATA\Programs\tsuzune\TSUZUNE.exe"
```

## 2026-08-15のv0.5.0実機結果

- `TSUZUNE-Setup-0.5.0.exe`: 103,607,215 bytes、SHA-256 `01a3ee9002f4d29bc4fc9c0df0e7ad00fb84f64f5964cfa7be14dbeb967bd6c7`
- blockmap: 108,962 bytes
- `latest.yml`のversion、ファイル名、SHA-512: PASS
- packaged `app.asar`のupdater import互換性: PASS
- HKCUへの`TSUZUNE 0.5.0`登録: PASS
- installed EXE: `%LOCALAPPDATA%\Programs\tsuzune\TSUZUNE.exe`
- レンダラーready fileを使う非表示起動smoke: packaged / installedともにPASS
- 同一版再インストール時の既存TSUZUNE状態ファイル: 57件確認 / 変更0件
- built／installed EXEと`app.asar`のSHA-256一致、本番profile不変、MCP再登録: PASS

機械可読な最新値は`docs/reports/production-update-latest.json`を正本とする。この節の件数やhashを将来の本番更新へ流用しない。

初回0.5.0では、ESM main processからCommonJS版`electron-updater`をnamed importしたため起動時に例外となった。default importへ修正し、上記の`app.asar`検査とrenderer ready smokeを出荷条件へ追加した。

## 未完了の本番リスク

- **コード署名**: 現在は未署名。Windows SmartScreenで発行元不明と表示され得る。一般配布前にはWindowsコード署名証明書を設定する。
- **二版間の実更新**: v0.6.0の公開Release、匿名latest API、3 assetのHTTP 200とdigest一致までは確認済み。このPCには本番と分離できるWindows Sandbox／VMがないため、v0.5.0からの検出、取得、保存、再起動、版更新は未実施。別Windows PC、専用VM、または本番と分離したWindows user／install環境を用意した時だけ再開する。
- **アプリアイコン**: 編み込まれた鈴を表す `tsuzune-app-icon.png` をWindows packageへ設定し、installer gateでElectron既定アイコンへの退行を検査する。通知領域には小サイズ専用の `tsuzune-tray-icon.png` を使う。
- **公開GitHub配信**: 更新確認とasset取得は匿名で行う。v0.6.0でtokenなしの更新確認を回帰testへ固定し、公開Release page／latest API／3 assetの匿名HTTP 200を確認済み。Release作成時だけmaintainerのGitHub認証を使用し、tokenをアプリ設定やVaultへ保存しない。
