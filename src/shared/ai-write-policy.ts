import { isExcludedFilePath, parseUserIgnoreFilters } from './excluded-files'

export const DEFAULT_AI_IMMUTABLE_PATHS = ['40_情報源', '50_履歴']

export function parseAiImmutablePaths(value: unknown): string[] {
  return parseUserIgnoreFilters(value)
}

export function parseAiReviewPaths(value: unknown): string[] {
  return parseUserIgnoreFilters(value)
}

export function isAiImmutablePath(
  path: string,
  additionalPaths: readonly string[] = []
): boolean {
  return isExcludedFilePath(path, [
    ...DEFAULT_AI_IMMUTABLE_PATHS,
    ...additionalPaths
  ])
}

export function isAiReviewPath(
  path: string,
  reviewPaths: readonly string[] = []
): boolean {
  return isExcludedFilePath(path, reviewPaths)
}
