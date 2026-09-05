# UI1 Reading Workspace Shell

Objective: stateを増やさず、本文を主役にするcompact shellへ整える。

Ownership: `src/renderer/styles.css`。必要なfixture selector調整は親agentが別途所有する。

Do: header約40px、tabs約36px、note headerの一段化、left actionの低優先度化、65〜75文字のEditor／Preview、900／720px境界。

Do not: App state、handler、ARIA DOM、Markdown semantics、新規dependencyを変更しない。

Verification: CSS diff review、typecheck、既存renderer tests、1440／900／720 visual。
