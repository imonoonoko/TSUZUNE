import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const HISTORY_RELATIVE_PATH = join("50_履歴", "AI更新");
const DEFAULT_THRESHOLD_BYTES = 2 * 1024 * 1024;
const ROTATION_WINDOW_DAYS = 30;
const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/i;

export interface HistoryEntry {
  path: string;
  target: string;
  recordedAt: string;
  reason: string;
  sourceRefs: string[];
  previousRevision: string;
  bytes: number;
  bodyBytes: number;
  bodySha256: string;
  recordSha256: string;
  bodyMarkerFound: boolean;
  targetPresent: boolean;
  recordedAtValid: boolean;
  revisionFormatValid: boolean;
  filenameRevisionMatches: boolean;
  previousModifiedAt: number | null;
  previousSizeBytes: number | null;
  revisionRootSha256: string;
  previousContent?: string;
}

interface HistoryInventory {
  files: number;
  bytes: number;
  aiRevisionFiles: number;
  aiRevisionBytes: number;
  excludedFiles: number;
  excludedBytes: number;
  excludedKinds: Record<string, number>;
  digest: string;
}

export interface HistoryScan {
  entries: HistoryEntry[];
  inventory: HistoryInventory;
}

interface FrontmatterBlock {
  text: string;
  length: number;
}

function frontmatterBlock(content: string): FrontmatterBlock | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? { text: match[1], length: match[0].length } : null;
}

function parseScalar(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function scalar(frontmatter: string, key: string): string {
  const prefix = `${key}:`;
  const line = frontmatter
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix));
  return line ? parseScalar(line.slice(prefix.length)) : "";
}

function sourceReferences(frontmatter: string): string[] {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line === "source_refs:");
  if (start < 0) return [];

  const references: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\s+-\s+(.+)$/);
    if (!match) break;
    const reference = parseScalar(match[1]);
    if (reference && reference !== "none") references.push(reference);
  }
  return references;
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function revisionFor(
  rootPath: string,
  target: string,
  modifiedAt: number,
  size: number,
  content: string,
): string {
  return `sha256:${createHash('sha256')
    .update(rootPath)
    .update('\0')
    .update(target)
    .update('\0')
    .update(String(modifiedAt))
    .update('\0')
    .update(String(size))
    .update('\0')
    .update(content)
    .digest('hex')}`;
}

function parseEntry(
  path: string,
  content: string,
  bytes: number,
  block: FrontmatterBlock,
): HistoryEntry {
  const previousContent = content.slice(block.length);
  const marker = previousContent.match(/^\r?\n# Previous content\r?\n\r?\n/);
  const body = marker ? previousContent.slice(marker[0].length) : "";
  const target = scalar(block.text, "target");
  const recordedAt = scalar(block.text, "recorded_at");
  const previousRevision = scalar(block.text, "previous_revision");
  const modifiedAtRaw = scalar(block.text, "previous_modified_at");
  const sizeRaw = scalar(block.text, "previous_size_bytes");
  const previousModifiedAt = modifiedAtRaw && /^\d+$/.test(modifiedAtRaw) ? Number(modifiedAtRaw) : null;
  const previousSizeBytes = sizeRaw && /^\d+$/.test(sizeRaw) ? Number(sizeRaw) : null;
  const revisionFormatValid = REVISION_PATTERN.test(previousRevision);
  const filenameSuffix = basename(path)
    .replace(/\.md$/i, "")
    .match(/-([a-f0-9]{12})$/i)?.[1];

  return {
    path,
    target,
    recordedAt,
    reason: scalar(block.text, "reason"),
    sourceRefs: sourceReferences(block.text),
    previousRevision,
    bytes,
    bodyBytes: Buffer.byteLength(body),
    bodySha256: sha256(body),
    recordSha256: sha256(content),
    bodyMarkerFound: Boolean(marker),
    targetPresent: Boolean(target),
    recordedAtValid:
      recordedAt.endsWith("Z") && Number.isFinite(Date.parse(recordedAt)),
    revisionFormatValid,
    filenameRevisionMatches: Boolean(
      revisionFormatValid &&
      filenameSuffix &&
      previousRevision.toLowerCase().endsWith(filenameSuffix.toLowerCase()),
    ),
    previousModifiedAt,
    previousSizeBytes,
    revisionRootSha256: scalar(block.text, "revision_root_sha256"),
    previousContent: body,
  };
}

async function markdownPaths(root: string): Promise<string[]> {
  const paths: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "ja"));
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        paths.push(relative(root, absolutePath).replaceAll("\\", "/"));
      }
    }
  }

  await visit(root);
  return paths;
}

export async function scanHistory(vaultPath: string): Promise<HistoryScan> {
  const directory = join(resolve(vaultPath), HISTORY_RELATIVE_PATH);
  const paths = await markdownPaths(directory);
  const entries: HistoryEntry[] = [];
  const excludedKinds: Record<string, number> = {};
  const digest = createHash("sha256");
  let bytes = 0;
  let excludedBytes = 0;

  for (const path of paths) {
    const contentBuffer = await readFile(join(directory, path));
    const content = contentBuffer.toString("utf8");
    const block = frontmatterBlock(content);
    const kind = block ? scalar(block.text, "kind") : "";
    const recordPath = `50_履歴/AI更新/${path}`;

    bytes += contentBuffer.length;
    digest.update(path).update("\0").update(contentBuffer).update("\0");
    if (kind === "ai_revision" && block) {
      entries.push(
        parseEntry(recordPath, content, contentBuffer.length, block),
      );
    } else {
      const key = kind || "unknown";
      excludedKinds[key] = (excludedKinds[key] ?? 0) + 1;
      excludedBytes += contentBuffer.length;
    }
  }

  return {
    entries,
    inventory: {
      files: paths.length,
      bytes,
      aiRevisionFiles: entries.length,
      aiRevisionBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      excludedFiles: paths.length - entries.length,
      excludedBytes,
      excludedKinds,
      digest: digest.digest("hex"),
    },
  };
}

function sortEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((left, right) => {
    const byTime = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
    return Number.isFinite(byTime) && byTime !== 0
      ? byTime
      : left.path.localeCompare(right.path, "ja");
  });
}

function manifestEntry(entry: HistoryEntry) {
  return {
    path: entry.path,
    recordedAt: entry.recordedAt,
    reason: entry.reason,
    sourceRefs: entry.sourceRefs,
    previousRevision: entry.previousRevision,
    previousModifiedAt: entry.previousModifiedAt,
    previousSizeBytes: entry.previousSizeBytes,
    revisionRootSha256: entry.revisionRootSha256,
    bytes: entry.bytes,
    bodyBytes: entry.bodyBytes,
    bodySha256: entry.bodySha256,
    recordSha256: entry.recordSha256,
    validation: {
      bodyMarkerFound: entry.bodyMarkerFound,
      targetPresent: entry.targetPresent,
      recordedAtValid: entry.recordedAtValid,
      revisionFormatValid: entry.revisionFormatValid,
      filenameRevisionMatches: entry.filenameRevisionMatches,
    },
  };
}

export function buildPreview(
  entries: HistoryEntry[],
  thresholdBytes = DEFAULT_THRESHOLD_BYTES,
  measuredAt = new Date(),
  rootPath?: string,
) {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.target) ?? [];
    group.push(entry);
    groups.set(entry.target, group);
  }

  const targets = [...groups.entries()]
    .map(([target, group]) => {
      const sorted = sortEntries(group);
      const bytes = sorted.reduce((sum, entry) => sum + entry.bytes, 0);
      const manifest = sorted.map(manifestEntry);
      const manifestBytes = Buffer.byteLength(
        `${JSON.stringify({ schemaVersion: 1, target, entries: manifest })}\n`,
      );
      const candidateForCompaction =
        bytes > thresholdBytes && sorted.length > 2;
      const keepPaths = candidateForCompaction
        ? [sorted[0].path, sorted.at(-1)!.path]
        : sorted.map((entry) => entry.path);
      const keptFullBytes = candidateForCompaction
        ? sorted[0].bytes + sorted.at(-1)!.bytes
        : bytes;
      const estimatedBytesAfter = candidateForCompaction
        ? keptFullBytes + manifestBytes
        : bytes;

      const chainVerification = (() => {
        const metadataValid = sorted.every(
          (entry) =>
            entry.previousModifiedAt !== null &&
            entry.previousSizeBytes !== null &&
            /^([a-f0-9]{64})$/i.test(entry.revisionRootSha256),
        );
        if (!metadataValid) return { status: "legacy-unverifiable" as const, reason: "Legacy records do not retain revision inputs." };
        if (!rootPath) return { status: "unverifiable" as const, reason: "A Vault root is required." };
        const expectedRoot = sha256(rootPath);
        const broken = sorted.some(
          (entry) => entry.revisionRootSha256.toLowerCase() !== expectedRoot ||
            entry.previousContent === undefined ||
            revisionFor(rootPath, entry.target, entry.previousModifiedAt!, entry.previousSizeBytes!, entry.previousContent) !== entry.previousRevision,
        );
        return broken
          ? { status: "broken" as const, reason: "Revision inputs do not reproduce previous_revision." }
          : { status: "verified" as const, reason: "Revision inputs reproduce previous_revision." };
      })();

      return {
        target,
        count: sorted.length,
        bytes,
        first: sorted[0]?.path ?? null,
        latest: sorted.at(-1)?.path ?? null,
        manifest,
        validation: {
          missingBodyMarkerCount: sorted.filter(
            (entry) => !entry.bodyMarkerFound,
          ).length,
          missingTargetCount: sorted.filter((entry) => !entry.targetPresent)
            .length,
          invalidRecordedAtCount: sorted.filter(
            (entry) => !entry.recordedAtValid,
          ).length,
          invalidRevisionFormatCount: sorted.filter(
            (entry) => !entry.revisionFormatValid,
          ).length,
          filenameRevisionMismatchCount: sorted.filter(
            (entry) => !entry.filenameRevisionMatches,
          ).length,
          duplicateRevisionCount:
            sorted.length -
            new Set(sorted.map((entry) => entry.previousRevision)).size,
        },
        chainVerification: chainVerification,
        compactionPreview: {
          candidateForCompaction,
          applyEligible: candidateForCompaction && chainVerification.status === "verified",
          keepPaths,
          manifestBytes,
          estimatedBytesAfter,
          estimatedSavingsBytes: Math.max(0, bytes - estimatedBytesAfter),
        },
      };
    })
    .sort(
      (left, right) =>
        right.bytes - left.bytes ||
        left.target.localeCompare(right.target, "ja"),
    );

  const rotationCutoff = new Date(
    measuredAt.getTime() - ROTATION_WINDOW_DAYS * 86_400_000,
  );
  const olderThanWindow = entries.filter(
    (entry) =>
      entry.recordedAtValid &&
      Date.parse(entry.recordedAt) < rotationCutoff.getTime(),
  );

  return {
    schemaVersion: 3,
    measuredAt: measuredAt.toISOString(),
    scope: "read-only history compaction preview",
    thresholdBytes,
    entryCount: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    targets,
    rotation: {
      windowDays: ROTATION_WINDOW_DAYS,
      cutoffUtc: rotationCutoff.toISOString(),
      olderThanWindowCount: olderThanWindow.length,
      olderThanWindowBytes: olderThanWindow.reduce(
        (sum, entry) => sum + entry.bytes,
        0,
      ),
    },
    proposedSavingsBytes: targets.reduce(
      (sum, target) => sum + target.compactionPreview.estimatedSavingsBytes,
      0,
    ),
    compaction: {
      applyEligible: false,
      reason:
        "Preview only. The current history schema cannot satisfy the required revision-chain verification gate.",
    },
    boundaries: [
      "No Vault files are created, changed, moved, compressed, or deleted.",
      "note_move, source-summary, and other non-ai_revision records are excluded from compaction candidates.",
      "Savings estimates retain the first and latest full snapshot and account for a metadata manifest for every entry.",
    ],
  };
}

function isInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) &&
      fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`))
  );
}

export async function previewVault(vaultPath: string, outputPath: string) {
  const vault = resolve(vaultPath);
  const output = resolve(outputPath);
  if (isInside(vault, output)) {
    throw new Error("Output must be outside the Vault.");
  }

  const before = await scanHistory(vault);
  const preview = buildPreview(before.entries, DEFAULT_THRESHOLD_BYTES, new Date(), vault);
  const after = await scanHistory(vault);
  const result = {
    ...preview,
    inventory: before.inventory,
    integrity: {
      beforeDigest: before.inventory.digest,
      afterDigest: after.inventory.digest,
      beforeFiles: before.inventory.files,
      afterFiles: after.inventory.files,
      beforeBytes: before.inventory.bytes,
      afterBytes: after.inventory.bytes,
      unchanged:
        before.inventory.digest === after.inventory.digest &&
        before.inventory.files === after.inventory.files &&
        before.inventory.bytes === after.inventory.bytes,
    },
  };

  await mkdir(dirname(output), { recursive: true });
  const rendered = output.toLowerCase().endsWith(".md")
    ? `# History compaction preview\n\n\`\`\`json\n${JSON.stringify(
        result,
        null,
        2,
      )}\n\`\`\`\n`
    : `${JSON.stringify(result, null, 2)}\n`;
  await writeFile(output, rendered, "utf8");
  return result;
}

function argument(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

export async function runCli(argv = process.argv) {
  const vault = argument(argv, "--vault");
  const output = argument(argv, "--output");
  if (!vault || !output) {
    throw new Error(
      "Usage: --vault <directory> --output <result.json|result.md>",
    );
  }

  const result = await previewVault(vault, output);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
