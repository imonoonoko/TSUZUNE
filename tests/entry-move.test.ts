import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EntryMoveCoordinator } from "../src/main/entry-move";
import { VaultService } from "../src/main/vault";

async function runCrashChild(
  root: string,
  stage: string,
): Promise<number | null> {
  const vitest = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        vitest,
        "run",
        "tests/fixtures/entry-move-crash.test.ts",
        "--maxWorkers=1",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TSUZUNE_CRASH_FIXTURE_ROOT: root,
          TSUZUNE_CRASH_FIXTURE_STAGE: stage,
        },
        stdio: "ignore",
      },
    );
    child.once("error", reject);
    child.once("close", resolve);
  });
}

describe("EntryMoveCoordinator M1", () => {
  let root: string;
  let vault: VaultService;
  let recordLocalMoves: Mock<
    (mappings: Array<{ oldPath: string; path: string }>) => Promise<void>
  >;
  let replacePendingMoves: Mock<
    (pendingMoves: Record<string, string>) => Promise<void>
  >;
  let pendingMoves: Record<string, string>;
  let coordinator: EntryMoveCoordinator;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tsuzune-entry-move-"));
    vault = new VaultService();
    await vault.setRootPath(root);
    await vault.createDirectory({ parent: "", name: "Inbox" });
    await vault.createDirectory({ parent: "", name: "Archive" });
    await vault.createNote({
      directory: "Inbox",
      name: "A",
      content: "# A\n\n本文",
    });
    pendingMoves = {};
    recordLocalMoves = vi.fn(async (mappings) => {
      for (const mapping of mappings)
        pendingMoves[mapping.oldPath] = mapping.path;
    });
    replacePendingMoves = vi.fn(async (replacement) => {
      pendingMoves = { ...replacement };
    });
    coordinator = new EntryMoveCoordinator({
      vault,
      drive: {
        inspectLocalMoves: vi.fn(async () => ({
          tracked: 1,
          untracked: 0,
          pendingMoves: { ...pendingMoves },
        })),
        recordLocalMoves,
        replacePendingMoves,
      },
    });
  });

  it("preflights and applies one AI Markdown move with one success audit", async () => {
    await vault.createNote({
      directory: "",
      name: "Ref",
      content: "[[Inbox/A]]",
    });

    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );

    expect(plan).toMatchObject({
      source_type: "markdown",
      source: "Inbox/A.md",
      destination: "Archive/A.md",
      counts: { markdown: 1, directories: 0, attachments: 0 },
      link_impact: { affected_count: 1 },
      drive: { tracked_moves: 1, untracked_uploads: 0 },
    });
    expect(plan.fingerprint).toMatch(/^sha256:/);

    const result = await coordinator.apply({
      source: plan.source,
      destination: plan.destination,
      expected_fingerprint: plan.fingerprint,
      actor: "ai",
      reason: "整理",
      source_refs: ["Inbox/方針.md"],
    });

    expect(result).toMatchObject({
      old_path: "Inbox/A.md",
      new_path: "Archive/A.md",
      fingerprint: plan.fingerprint,
    });
    expect(result.history_path).toMatch(/^50_履歴\/AI更新\/.*\.md$/);
    expect(await readFile(join(root, "Archive", "A.md"), "utf8")).toBe(
      "# A\n\n本文",
    );
    await expect(access(join(root, "Inbox", "A.md"))).rejects.toBeDefined();
    expect(recordLocalMoves).toHaveBeenCalledWith([
      { oldPath: "Inbox/A.md", path: "Archive/A.md" },
    ]);
    expect(await readFile(join(root, result.history_path!), "utf8")).toContain(
      "fingerprint: " + plan.fingerprint,
    );
  });

  it("allows an AI to move a normal note into 40_情報源", async () => {
    await vault.createDirectory({ parent: "", name: "40_情報源" });

    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "40_情報源/A.md",
      "ai",
    );
    expect(plan).toMatchObject({
      source: "Inbox/A.md",
      destination: "40_情報源/A.md",
    });
    await coordinator.apply({
      source: plan.source,
      destination: plan.destination,
      expected_fingerprint: plan.fingerprint,
      actor: "ai",
      reason: "原典化",
      source_refs: [],
    });
    await expect(
      readFile(join(root, "40_情報源", "A.md"), "utf8"),
    ).resolves.toBe("# A\n\n本文");
    await expect(access(join(root, "Inbox", "A.md"))).rejects.toBeDefined();
  });

  it("allows AI moves within 40_情報源 but not out of it", async () => {
    await vault.createDirectory({ parent: "", name: "40_情報源" });
    await vault.createDirectory({ parent: "40_情報源", name: "整理済み" });
    await vault.createNote({
      directory: "40_情報源",
      name: "原典",
      content: "# 原典",
    });

    await expect(
      coordinator.preflight(
        "40_情報源/原典.md",
        "40_情報源/整理済み/原典.md",
        "ai",
      ),
    ).resolves.toMatchObject({ destination: "40_情報源/整理済み/原典.md" });
    await expect(
      coordinator.preflight("40_情報源/原典.md", "Archive/原典.md", "ai"),
    ).rejects.toThrow("保護領域");
  });

  it("keeps 50_履歴 protected from every move", async () => {
    await vault.createDirectory({ parent: "", name: "50_履歴" });
    await vault.createNote({
      directory: "50_履歴",
      name: "監査",
      content: "# 監査",
    });

    await expect(
      coordinator.preflight("50_履歴/監査.md", "Archive/監査.md", "ai"),
    ).rejects.toThrow("保護領域");
    await expect(
      coordinator.preflight("Inbox/A.md", "50_履歴/A.md", "ai"),
    ).rejects.toThrow("保護領域");
  });

  it("rejects a stale fingerprint without moving anything", async () => {
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );
    await writeFile(join(root, "Inbox", "A.md"), "# A\n\n外部変更", "utf8");

    await expect(
      coordinator.apply({
        source: plan.source,
        destination: plan.destination,
        expected_fingerprint: plan.fingerprint,
        actor: "ai",
        reason: "整理",
        source_refs: [],
      }),
    ).rejects.toThrow("preflight");

    expect(await readFile(join(root, "Inbox", "A.md"), "utf8")).toContain(
      "外部変更",
    );
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
    expect(recordLocalMoves).not.toHaveBeenCalled();
  });

  it("rolls the filesystem back when the Drive ledger update fails", async () => {
    recordLocalMoves.mockRejectedValueOnce(new Error("LEDGER_WRITE_FAILED"));
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );

    await expect(
      coordinator.apply({
        source: plan.source,
        destination: plan.destination,
        expected_fingerprint: plan.fingerprint,
        actor: "ai",
        reason: "整理",
        source_refs: [],
      }),
    ).rejects.toThrow("LEDGER_WRITE_FAILED");

    expect(await readFile(join(root, "Inbox", "A.md"), "utf8")).toBe(
      "# A\n\n本文",
    );
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
  });

  it("restores the Drive ledger and filesystem when audit creation fails", async () => {
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );
    vi.spyOn(vault, "createNote").mockRejectedValueOnce(
      new Error("AUDIT_WRITE_FAILED"),
    );

    await expect(
      coordinator.apply({
        source: plan.source,
        destination: plan.destination,
        expected_fingerprint: plan.fingerprint,
        actor: "ai",
        reason: "整理",
        source_refs: [],
      }),
    ).rejects.toThrow("AUDIT_WRITE_FAILED");

    expect(replacePendingMoves).toHaveBeenCalledWith({});
    expect(pendingMoves).toEqual({});
    await expect(access(join(root, "Inbox", "A.md"))).resolves.toBeUndefined();
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
  });

  it("recovers a crash state after the filesystem and ledger stages", async () => {
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );
    const note = await vault.readNote(plan.source);
    const digest = createHash("sha256");
    for (const part of [
      String(note.modifiedAt),
      String(note.size),
      note.content,
    ]) {
      digest.update(part).update("\0");
    }
    await mkdir(join(root, ".tsuzune"), { recursive: true });
    await writeFile(
      join(root, ".tsuzune", "pending-entry-move.json"),
      JSON.stringify({
        version: 1,
        operation_id: "crash-fixture",
        stage: "ledger",
        actor: "ai",
        source: plan.source,
        destination: plan.destination,
        fingerprint: plan.fingerprint,
        content_revision: `sha256:${digest.digest("hex")}`,
        drive_tracked: true,
        pending_moves_before: {},
        history_path: "50_履歴/AI更新/planned.md",
      }),
      "utf8",
    );
    await vault.moveNote({
      path: plan.source,
      destinationDirectory: "Archive",
      destinationPath: plan.destination,
    });
    pendingMoves = { "Inbox/A.md": "Archive/A.md" };

    await expect(coordinator.recover()).resolves.toEqual({
      status: "recovered",
      action: "rolled-back",
    });
    await expect(access(join(root, "Inbox", "A.md"))).resolves.toBeUndefined();
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
    expect(pendingMoves).toEqual({});
    await expect(
      access(join(root, ".tsuzune", "pending-entry-move.json")),
    ).rejects.toBeDefined();
  });

  it("fails closed when both source and destination exist during recovery", async () => {
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );
    const note = await vault.readNote(plan.source);
    const digest = createHash("sha256");
    for (const part of [
      String(note.modifiedAt),
      String(note.size),
      note.content,
    ]) {
      digest.update(part).update("\0");
    }
    await mkdir(join(root, ".tsuzune"), { recursive: true });
    await writeFile(join(root, "Archive", "A.md"), note.content, "utf8");
    await writeFile(
      join(root, ".tsuzune", "pending-entry-move.json"),
      JSON.stringify({
        version: 1,
        operation_id: "ambiguous-fixture",
        stage: "filesystem",
        actor: "ai",
        source: plan.source,
        destination: plan.destination,
        fingerprint: plan.fingerprint,
        content_revision: `sha256:${digest.digest("hex")}`,
        drive_tracked: true,
        pending_moves_before: {},
        history_path: "50_履歴/AI更新/planned.md",
      }),
      "utf8",
    );

    await expect(coordinator.recover()).resolves.toEqual({
      status: "recovery-required",
      source: "Inbox/A.md",
      destination: "Archive/A.md",
    });
    await expect(
      coordinator.preflight("Inbox/A.md", "Archive/B.md", "ai"),
    ).rejects.toThrow("RECOVERY_REQUIRED");
  });

  it("recovers real child-process exits at every durable stage", async () => {
    const cases = [
      ["prepared", "discarded"],
      ["filesystem", "rolled-back"],
      ["ledger", "rolled-back"],
      ["audit", "committed"],
    ] as const;

    for (const [stage, action] of cases) {
      const crashRoot = await mkdtemp(
        join(tmpdir(), `tsuzune-crash-${stage}-`),
      );
      const crashVault = new VaultService();
      await crashVault.setRootPath(crashRoot);
      await crashVault.createDirectory({ parent: "", name: "Inbox" });
      await crashVault.createDirectory({ parent: "", name: "Archive" });
      await crashVault.createNote({
        directory: "Inbox",
        name: "A",
        content: "# A\n\ncrash",
      });
      await writeFile(join(crashRoot, "drive-pending.json"), "{}", "utf8");

      // The Vitest worker exits with 86; its parent runner reports the crashed worker as 1.
      expect(await runCrashChild(crashRoot, stage)).toBe(1);

      const readPending = async (): Promise<Record<string, string>> =>
        JSON.parse(
          await readFile(join(crashRoot, "drive-pending.json"), "utf8"),
        ) as Record<string, string>;
      const recovered = new EntryMoveCoordinator({
        vault: crashVault,
        drive: {
          inspectLocalMoves: async () => ({
            tracked: 1,
            untracked: 0,
            pendingMoves: await readPending(),
          }),
          recordLocalMoves: async () => undefined,
          replacePendingMoves: async (replacement) =>
            writeFile(
              join(crashRoot, "drive-pending.json"),
              JSON.stringify(replacement),
              "utf8",
            ),
        },
      });

      await expect(recovered.recover()).resolves.toEqual({
        status: "recovered",
        action,
      });
    }
  }, 60_000);
});
