# MV3-01

- Objective: 第三者extractorとYouTube取得をMV3へ安全に配布する制約を確定する。
- Sources: Chrome Extensions公式documentationと現行manifest／packaging source。
- Ownership: read-only research。
- Do: isolated/main world、files injection、CSP、host permissions、allFrames、extension asset packagingを確認する。
- Do not: code編集、permission追加、Chrome Web Store公開。
- Output: 許可される実装形、避けるべき形、必要な回帰test。
- Stop: 新しい広域権限が必須なら親へ不採用提案を返す。

