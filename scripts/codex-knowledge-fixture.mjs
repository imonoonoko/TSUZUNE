import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Synthetic materials only; shared by transport acceptance and the model-driven run.
export const resultOriginal = '\uFEFF# 比較結果\r\n\r\n## 追記欄\r\nまだ比較していない。\r\n\r\n<!-- 保全対象 -->\r\n## 保持欄\r\nこの本文は変更しない。\r\n'
export async function createKnowledgeFixture(vault) {
  await mkdir(vault, { recursive: true })
  const notes = {
    '判断記録.md': '---\nstatus: adopted\npriority: 3\ndate: "2026-09-20"\n---\n# 保存方式の判断\n## 判断と理由\n9月20日にMarkdownを正本とする方式を採用した。理由は他の編集ツールで読めることと、障害時にデータを取り出せること。速度の利点があった専用DB案は見送った。\n## 未確認\n大量ファイルの検索速度は未測定。\n[[比較A]]\n',
    '比較A.md': '---\npriority: 2\nstatus: adopted\n---\n# ローカル設計\n## 根拠\nローカル保存は通信なしで利用できる。端末を失うとバックアップなしでは復元できない。\n[[比較B]]\n[創作への接点](創作.md#考察)\n',
    '比較B.md': '---\npriority: 1\nstatus: candidate\n---\n# クラウド設計\n## 根拠\nクラウド保存は別端末から参照できる。通信が切れると参照できない。費用はまだ比較していない。\n[[比較C]]\n',
    '比較C.md': '---\npriority: 3\nstatus: adopted\n---\n# 併用設計\n## 根拠\nローカルとクラウドの併用では別端末参照とオフライン利用を両立できる。ただし同期競合の実装が必要で、現時点では未実装。\n',
    '創作.md': '# 創作\n## 考察\n作品の途中経過を保存しておくと、以前の案から再開しやすい。\n[[哲学]]\n',
    '哲学.md': '# 哲学\n判断の変化を残すことは、結論だけを記憶する場合より理由を再検討しやすい。\n',
    '比較結果.md': resultOriginal,
    '設計比較.base': '# コメントは読取で変えない\nviews:\n  - type: table\n    name: 採用候補\n    filters:\n      and:\n        - file.name.startsWith("比較")\n        - status == "adopted"\n    order: [file.name, priority]\n    sort:\n      - property: priority\n        direction: DESC\n  - type: table\n    name: 全候補\n    filters: file.name.startsWith("比較")\n    order: [file.name, priority]\n'
  }
  for (const [name, body] of Object.entries(notes)) await writeFile(join(vault, name), body)
}

export const knowledgePrompts = [
  'TSUZUNEで、保存方式について以前の判断と理由を調べて。根拠のノートと見出し、短い引用を示し、未確認も区別して。',
  'TSUZUNEの比較A、比較B、比較Cの3件を比較し、違いと根拠を示して。',
  'TSUZUNEの設計比較という表の採用候補ビューにあるノートを比較して。どの行が対象かと根拠を示して。',
  'TSUZUNEのローカル設計の周囲を2段たどり、別分野との接点を探して。実際のリンクとあなたの解釈を区別して。',
  'TSUZUNEの比較A、比較B、比較Cを比較し、比較結果ノートの追記欄へ違いと出典を反映して。保持欄とコメントはそのまま残し、保存後に確認して。',
  'TSUZUNEに保存した比較結果を読み、そこから続きを考えて。保存済みの事実と新しい提案を分けて。'
]

export async function createEvidenceFixture(vault) {
  const notes = {
    '技術/見直し.md': '# 検索方式の見直し\n## 採用理由\n索引を毎回作る方式を採用した。小さなVaultでは実装と復旧が簡単だった。\n## 現在の判断\n大きなVaultでの検証は未実施。\n',
    '創作/見直し.md': '# 作品の見直し\n## 採用理由\n結末を先に決める方式は伏線を置きやすかった。検索方式の判断は扱わない。\n',
    '索引方式.md': '---\naliases: [逐次索引, SIF]\n---\n# 索引方式\n## 採用理由\n逐次索引（SIF）は変更時に索引を更新する方式。手動の再構築を減らすために試した。\n',
    '長期検討.md': '# 長期検討\n## 事前調査\n' + '初期調査の観察記録。結論は未確定。\n'.repeat(1800) + '## 最終判断\n10月1日に大規模運用を保留した。根拠は更新中断からの復旧を確認できなかったこと。\n',
    '反対意見.md': '# 比較検討\n## 反対意見\n初期案では費用が高いという反対意見があった。\n## 中間整理\n費用の問題は解消した。\n## 反対意見\n後半では、復旧手順が未検証という反対意見が残った。\n',
    '採用.md': '---\nvalid_from: 2026-09-20\n---\n# 高速索引の採用\n## 採用理由\n速度の測定結果を理由に高速索引を採用した。\n[[撤回]]\n',
    '撤回.md': '---\nvalid_from: 2026-09-29\nsupersedes: 採用\n---\n# 高速索引の撤回\n## 現在の判断\n9月29日に高速索引の採用を撤回した。理由は停電時の索引復旧に失敗したこと。再採用は復旧検証まで保留する。\n[[採用]]\n'
  };
  for (const [name, text] of Object.entries(notes)) { await mkdir(join(vault, name, '..'), {recursive:true}); await writeFile(join(vault,name),text); }
}
export const evidencePrompts = [
 'TSUZUNEの見直しの記録から、技術上の検索方式を採用した理由を調べて。作品の話と区別し、出典のパスと見出しと短い引用を示して。',
 'TSUZUNEで、SIFという変更時に索引を更新する方式を試した理由を調べて。略称と正式な説明を照合して、根拠と不明点を示して。',
 'TSUZUNEの長期検討で、事前調査の後の最終判断と、その理由を確認して。原文の短い引用と位置を示し、未取得があれば区別して。',
 'TSUZUNEの反対意見の記録で、費用が解消した後、後半に残った反対意見を確認して。最初の同名見出しと混同せず、引用と位置を示して。',
 'TSUZUNEで高速索引を採用した理由と、その後も有効なのかを照合して。後日の変更と現在確認できる判断、あなたの解釈、未確認を分けて示して。',
 'TSUZUNEで量子記憶媒体の復旧試験の結果を探して。見つからなければ検索した範囲と不足を示し、知識全体にないとは断定しないで。'
];
