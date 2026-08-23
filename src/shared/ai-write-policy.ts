import { isExcludedFilePath, parseUserIgnoreFilters } from "./excluded-files";

export const DEFAULT_AI_IMMUTABLE_PATHS = ["40_情報源", "50_履歴"];
const AUDIT_HISTORY_PATHS = ["50_履歴"];
const SOURCE_MATERIAL_PATHS = ["40_情報源"];

export function parseAiReviewPaths(value: unknown): string[] {
  return parseUserIgnoreFilters(value);
}

export function isAiImmutablePath(path: string): boolean {
  return isExcludedFilePath(path, DEFAULT_AI_IMMUTABLE_PATHS);
}

export function isAuditHistoryPath(path: string): boolean {
  return isExcludedFilePath(path, AUDIT_HISTORY_PATHS);
}

export function isAiMoveProtected(
  source: string,
  destination: string,
): boolean {
  if (isAuditHistoryPath(source) || isAuditHistoryPath(destination))
    return true;
  return (
    isExcludedFilePath(source, SOURCE_MATERIAL_PATHS) &&
    !isExcludedFilePath(destination, SOURCE_MATERIAL_PATHS)
  );
}

export function isAiReviewPath(
  path: string,
  reviewPaths: readonly string[] = [],
): boolean {
  return isExcludedFilePath(path, reviewPaths);
}
