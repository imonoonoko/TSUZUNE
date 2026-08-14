# CP1-C-07 Production Classification Apply Packet — 2026-08-14

## Outcome

本番分類適用の承認パケットを作成したが、判定は `blocked-before-approval` である。本番Vaultへのapplyは実行していない。

ローカル側はTSUZUNE writebackの履歴増分まで含む最新の本番Vaultをread-onlyで再解析し、5 moves、15,601 bytes、140 Wiki参照、23 rollback preimagesを固定した。Vault全体は547 files／14,844,742 bytesで、dry-run前後のfingerprintは一致した。

Drive側はGoogleアカウント接続済みだが、active production Vaultの同期台帳にpaired rootと完了済みsync baselineがない。したがって、対象5件のremote file ID、version、parent、content hash、Path Alias objectを安全に固定できず、現時点ではapply承認を求められない。

## Frozen artifacts

- plan: `docs/migrations/o2-production-classification-apply-plan.json`
- approval packet: `docs/migrations/o2-production-classification-apply-packet.json`
- approval packet SHA-256: `355728C2188F757759B27C6D7781C9A9CB24AF072A9238615CC8982DCB9123B3`
- plan SHA-256: `E86811315A0EF37B8B336D942F6AFEA5474D37734A1771460D126443FAF60E25`
- local preview manifest SHA-256: `E2ABF572F653B438855D11AB2D17DF8E7C52C676C3799CC7384D8A1911E8D248`
- Vault fingerprint: `71045B062E9B3F407317F50AB0C2DB1C80ADE8165D4D300F9A23BA1FF5D2F74A`

## Exact local target set

| Source | Destination | Bytes |
|---|---|---:|
| `30_知識/TSUZUNE-Google連携・同期・障害対応.md` | `30_知識/ソフトウェア開発/TSUZUNE-Google連携・同期・障害対応.md` | 2,699 |
| `30_知識/TSUZUNE-MCPとAI書き込み運用.md` | `30_知識/ソフトウェア開発/TSUZUNE-MCPとAI書き込み運用.md` | 6,272 |
| `30_知識/TSUZUNE-データ保護・バックアップ・復旧.md` | `30_知識/ソフトウェア開発/TSUZUNE-データ保護・バックアップ・復旧.md` | 2,300 |
| `30_知識/TSUZUNE-開発開始と区切りの標準ループ.md` | `30_知識/ソフトウェア開発/TSUZUNE-開発開始と区切りの標準ループ.md` | 2,078 |
| `30_知識/TSUZUNE-本番更新・インストール・Release運用.md` | `30_知識/ソフトウェア開発/TSUZUNE-本番更新・インストール・Release運用.md` | 2,252 |

## Local preview

| Check | Result |
|---|---:|
| move count | 5 |
| moved bytes | 15,601 |
| Wiki reference occurrences | 140 |
| reference files | 118 |
| active／immutable source／history | 35／4／101 |
| projected MCP backlinks | 137 |
| rollback preimages | 23 |
| required directory | `30_知識/ソフトウェア開発` |
| Path Alias sidecar before apply | absent |
| Vault unchanged | PASS |

O2-P2の2026-08-10 planは、3 target notesと参照baselineがその後の正規更新でdriftしていたため、そのまま再利用していない。最新bytes、hash、参照数を新しいplanへ固定し、既存preview engineでprojection equivalenceを再検証した。

## Drive preview blocker

Google再接続とdisposable live Drive acceptanceはPASS済みだが、これは本番Vaultの同期baselineではない。現在のactive production Vault ledgerは次の状態である。

- account connected: yes
- local Vault ledger entry: yes
- paired remote root: no
- completed sync baseline: no
- remote identities for the five planned paths: not observable safely

よって、既存の別Vaultを推測でpairしたり、remote file IDを新規作成と取り違えたりしない。通常UIの「同期内容を確認」から意図したDrive Vaultを選び、正常なpreview／syncを一度完了した後にremote previewを固定する。

## Rollback and stop boundary

rollbackは、remote Markdown metadataを逆順復元、remote Path Alias exact bytes復元、両ledger復元、local O2-P3 rollback、完全fingerprint再検証の順とする。未復元が一件でもあればrecovery packetを保持して停止する。

apply前には、23 preimages、destination不存在、sidecar状態、Driveの一意な所有object、file ID binding、version、parent、content hash、alias ownershipを再検証する。TSUZUNE実行中、Vault／plan drift、既存recovery packet、remote候補0件または複数、immutable source／historyへのwriteが一つでもあれば停止する。

## Decision

本番applyは引き続き禁止する。次は製品コードを増やさず、通常のGoogle Drive同期でactive production Vaultのpaired rootとclean baselineを確立する。その後、Drive preview sectionだけを更新し、初めて明示的なapply承認を求める。

## Verification

- existing classification preview build: PASS
- refreshed production-Vault dry-run: PASS
- local Vault unchanged: PASS
- JSON parse for plan and packet: PASS
- packet／manifest field match: PASS
- Ponytail review: Lean already. 製品入口、依存、production apply executorは追加していない
- product code／installed app／Drive writes: 0
- classification apply writes: 0
- authorized TSUZUNE status writeback: project noteと現在地MOCの2件。各preimageはAI更新履歴へ保存し、その履歴増分を含めて最終previewを再固定

## References

- `docs/reports/cp1-c-02-o2-p3-prototype-2026-08-13.md`
- `docs/reports/cp1-c-05-o2-p4b-relocation-recovery-prototype-2026-08-13.md`
- `docs/reports/cp1-c-06-disposable-live-drive-acceptance-2026-08-14.md`
- `docs/migrations/o2-production-classification-apply-plan.json`
- `docs/migrations/o2-production-classification-apply-packet.json`
