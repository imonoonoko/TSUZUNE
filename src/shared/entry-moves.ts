import { basenameRelative, dirnameRelative, isPathInsideOrEqual, joinRelative, validateRelativePath } from '../core/paths'

export function planBulkEntryMoves(
  paths: readonly string[],
  destination: string,
  existingPaths: readonly string[],
  directories: readonly string[]
): string[] {
  const folders = new Set(directories)
  if (!validateRelativePath(destination).valid || (destination !== '' && !folders.has(destination))) {
    throw new Error('移動先のフォルダーを確認してください。')
  }
  const existing = new Set(existingPaths)
  const occupied = new Set(existingPaths.map(path => path.toLocaleLowerCase()))
  const unique = [...new Set(paths)]
  if (unique.some(path => !path || !validateRelativePath(path).valid || !existing.has(path))) {
    throw new Error('選択した項目が変更されています。')
  }
  const roots = unique.filter(path => !unique.some(parent =>
    parent !== path && folders.has(parent) && isPathInsideOrEqual(path, parent)))
  const targets = new Set<string>()
  return roots.filter(path => {
    if (folders.has(path) && isPathInsideOrEqual(destination, path)) {
      throw new Error('フォルダーの内側へは移動できません。')
    }
    if (dirnameRelative(path) === destination) return false
    const target = joinRelative(destination, basenameRelative(path)).toLocaleLowerCase()
    if (targets.has(target)) throw new Error('選択に同じ名前の項目があります。個別に移動してください。')
    if (occupied.has(target)) throw new Error('移動先に同じ名前の項目が既にあります。')
    targets.add(target)
    return true
  })
}

type MoveResult = false | { moved: true; continue: boolean }

export async function runBulkEntryMoves(
  paths: readonly string[],
  move: (path: string) => Promise<MoveResult>
): Promise<{ completed: string[]; remaining: string[] }> {
  const completed: string[] = []
  for (const path of paths) {
    let result: MoveResult
    try {
      result = await move(path)
    } catch {
      break
    }
    if (!result) break
    completed.push(path)
    if (!result.continue) break
  }
  return { completed, remaining: paths.slice(completed.length) }
}
