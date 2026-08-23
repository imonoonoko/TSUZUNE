import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPreview,
  previewVault,
  type HistoryEntry,
} from "../scripts/preview-history-compaction";

const run = promisify(execFile);
const temporaryRoots: string[] = [];

function entry(path: string, target: string, bytes: number): HistoryEntry {
  const body = `body-${path}`;
  return {
    path,
    target,
    recordedAt: "2026-08-16T00:00:00.000Z",
    reason: "実production format",
    sourceRefs: ["source.md"],
    previousRevision: `sha256:${"a".repeat(64)}`,
    bytes,
    bodyBytes: Buffer.byteLength(body),
    bodySha256: createHash("sha256").update(body).digest("hex"),
    recordSha256: createHash("sha256").update(body).digest("hex"),
    bodyMarkerFound: true,
    targetPresent: true,
    recordedAtValid: true,
    revisionFormatValid: true,
    filenameRevisionMatches: true,
    previousModifiedAt: null,
    previousSizeBytes: null,
    revisionRootSha256: "",
  };
}

function verifiedEntry(
  root: string,
  path: string,
  target: string,
  modifiedAt: number,
  content: string,
  bytes = 900_000,
): HistoryEntry {
  const revision = `sha256:${createHash("sha256")
    .update(root).update("\0").update(target).update("\0")
    .update(String(modifiedAt)).update("\0").update(String(Buffer.byteLength(content)))
    .update("\0").update(content).digest("hex")}`;
  return {
    ...entry(path, target, bytes),
    previousRevision: revision,
    previousModifiedAt: modifiedAt,
    previousSizeBytes: Buffer.byteLength(content),
    revisionRootSha256: createHash("sha256").update(root).digest("hex"),
    previousContent: content,
    bodyBytes: Buffer.byteLength(content),
    bodySha256: createHash("sha256").update(content).digest("hex"),
  };
}

function revisionRecord(kind = "ai_revision"): string {
  return [
    "---",
    `kind: ${kind}`,
    "target: 10_プロジェクト/TSUZUNE.md",
    "actor: ai",
    'reason: "最終境界へまとめるため。"',
    "source_refs:",
    '  - "30_知識/Source.md"',
    `previous_revision: sha256:${"a".repeat(64)}`,
    "recorded_at: 2026-08-16T00:00:00.000Z",
    "---",
    "",
    "# Previous content",
    "",
    "# TSUZUNE",
    "",
    "前の本文。",
  ].join("\n");
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("history compaction preview", () => {
  it("verifies a valid new-format chain and allows only its candidate preview", () => {
    const root = "C:/fixture/vault";
    const result = buildPreview([
      verifiedEntry(root, "a.md", "A.md", 1, "one"),
      verifiedEntry(root, "b.md", "A.md", 2, "two"),
      verifiedEntry(root, "c.md", "A.md", 3, "three"),
    ], 1, new Date("2026-08-16T00:00:00.000Z"), root);
    expect(result.targets[0].chainVerification.status).toBe("verified");
    expect(result.targets[0].compactionPreview.applyEligible).toBe(true);
  });

  it("rejects body, metadata, or root tampering and accepts an empty body", () => {
    const root = "C:/fixture/vault";
    const valid = verifiedEntry(root, "a.md", "A.md", 1, "", 900_000);
    const valid2 = verifiedEntry(root, "b.md", "A.md", 2, "two", 900_000);
    const valid3 = verifiedEntry(root, "c.md", "A.md", 3, "three", 900_000);
    expect(buildPreview([valid, valid2, valid3], 1, new Date(), root).targets[0].chainVerification.status).toBe("verified");

    const broken = { ...valid2, previousContent: "changed" };
    expect(buildPreview([valid, broken, valid3], 1, new Date(), root).targets[0]).toMatchObject({
      chainVerification: { status: "broken" },
      compactionPreview: { applyEligible: false },
    });
    expect(buildPreview([valid, valid2, valid3], 1, new Date(), "C:/other").targets[0].chainVerification.status).toBe("broken");
  });

  it("accounts for manifest bytes but never authorizes an unverifiable chain", () => {
    const result = buildPreview(
      [
        entry("a-aaaaaaaaaaaa.md", "A.md", 1_000_000),
        entry("b-aaaaaaaaaaaa.md", "A.md", 1_500_000),
        entry("c-aaaaaaaaaaaa.md", "A.md", 500_000),
        entry("d-aaaaaaaaaaaa.md", "B.md", 4),
      ],
      2 * 1024 * 1024,
      new Date("2026-08-16T00:00:00.000Z"),
    );

    expect(result.targets[0]).toMatchObject({
      count: 3,
      chainVerification: { status: "legacy-unverifiable" },
      compactionPreview: {
        candidateForCompaction: true,
        applyEligible: false,
      },
    });
    expect(result.targets[0].manifest[0]).toHaveProperty("recordSha256");
    expect(result.targets[0].compactionPreview.manifestBytes).toBeGreaterThan(
      0,
    );
    expect(
      result.targets[0].compactionPreview.estimatedSavingsBytes,
    ).toBeLessThan(1_500_000);
    expect(result.compaction.applyEligible).toBe(false);
  });

  it("runs the real CLI without changing production-format history files", async () => {
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "tsuzune-preview-test-"),
    );
    temporaryRoots.push(temporaryRoot);
    const vault = join(temporaryRoot, "Vault");
    const history = join(vault, "50_履歴", "AI更新");
    const revisionPath = join(
      history,
      "2026-08-16T00-00-00-000Z-10_-TSUZUNE-aaaaaaaaaaaa.md",
    );
    const movePath = join(history, "2026-08-16T00-00-01-000Z-note-move.md");
    const output = join(temporaryRoot, "preview.json");
    await mkdir(history, { recursive: true });
    await writeFile(revisionPath, revisionRecord(), "utf8");
    await writeFile(movePath, revisionRecord("note_move"), "utf8");
    const before = await readFile(revisionPath, "utf8");

    await run(process.execPath, [
      resolve("scripts/run-preview-history-compaction.mjs"),
      "--vault",
      vault,
      "--output",
      output,
    ]);

    const result = JSON.parse(await readFile(output, "utf8"));
    expect(result).toMatchObject({
      entryCount: 1,
      inventory: {
        files: 2,
        aiRevisionFiles: 1,
        excludedFiles: 1,
        excludedKinds: { note_move: 1 },
      },
      integrity: { unchanged: true },
    });
    expect(result.targets[0]).toMatchObject({
      target: "10_プロジェクト/TSUZUNE.md",
      validation: {
        missingBodyMarkerCount: 0,
        invalidRevisionFormatCount: 0,
        filenameRevisionMismatchCount: 0,
      },
    });
    expect(await readFile(revisionPath, "utf8")).toBe(before);
    await expect(
      previewVault(vault, join(vault, "preview.json")),
    ).rejects.toThrow("outside the Vault");
  });
});
