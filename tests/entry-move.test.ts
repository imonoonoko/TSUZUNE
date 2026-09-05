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
  actor = "ai",
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
          TSUZUNE_CRASH_FIXTURE_ACTOR: actor,
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

  it("preflights and applies one AI Markdown move without history", async () => {
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
    });

    expect(result).toMatchObject({
      old_path: "Inbox/A.md",
      new_path: "Archive/A.md",
      fingerprint: plan.fingerprint,
    });
    expect(result).not.toHaveProperty("history_path");
    expect(await readFile(join(root, "Archive", "A.md"), "utf8")).toBe(
      "# A\n\n本文",
    );
    await expect(access(join(root, "Inbox", "A.md"))).rejects.toBeDefined();
    expect(recordLocalMoves).toHaveBeenCalledWith([
      { oldPath: "Inbox/A.md", path: "Archive/A.md" },
    ]);
    await expect(access(join(root, "50_履歴", "AI更新"))).rejects.toBeDefined();
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
      }),
    ).rejects.toThrow("LEDGER_WRITE_FAILED");

    expect(await readFile(join(root, "Inbox", "A.md"), "utf8")).toBe(
      "# A\n\n本文",
    );
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
  });

  it("follows human move links without reserializing the referring note", async () => {
    const before = '\uFEFF---\r\nref: "[[Inbox/A#見出し| 表示 ]]" # retain\r\nkeep: 9007199254740993\r\n---\r\n[[Inbox/A]] [表示](Inbox/A.md#見出し "title")\r\n`[[Inbox/A]]`\r\n';
    await writeFile(join(root, 'Ref.md'), before, 'utf8');
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    expect(await readFile(join(root, 'Ref.md'))).toEqual(Buffer.from(
      before.replace('Inbox/A#', 'Archive/B#').replace('[[Inbox/A]] [表示](Inbox/A.md', '[[Archive/B]] [表示](Archive/B.md')
    ));
    expect(await readFile(join(root, 'Archive/B.md'), 'utf8')).toBe('# A\n\n本文');
  });

  it.each(['|', '>', '|2-', '>+'])("rejects affected YAML block values before moving (%s)", async (style) => {
    const before = `---\nref: ${style}\n  # [[Inbox/A]]\nkeep: unchanged\n---\n`;
    await writeFile(join(root, 'Ref.md'), before);
    await expect(coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human'))
      .rejects.toThrow('YAML');
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe(before);
    await expect(access(join(root, 'Inbox/A.md'))).resolves.toBeUndefined();
    await expect(access(join(root, '.tsuzune/pending-entry-move.json'))).rejects.toBeDefined();
  });

  it("restores link bytes after a ledger failure, including explicit self links", async () => {
    const original = '\uFEFF# A\r\n[[Inbox/A]]\r\n';
    await writeFile(join(root, 'Inbox/A.md'), original);
    await writeFile(join(root, 'Ref.md'), '[[Inbox/A]]');
    recordLocalMoves.mockRejectedValueOnce(new Error('ledger failed'));
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await expect(coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' })).rejects.toThrow('ledger failed');
    expect(await readFile(join(root, 'Inbox/A.md'), 'utf8')).toBe(original);
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe('[[Inbox/A]]');
    await expect(access(join(root, '.tsuzune/pending-entry-move.json'))).rejects.toBeDefined();
  });

  it("rejects stale referring-note revisions before moving", async () => {
    await writeFile(join(root, 'Ref.md'), '[[Inbox/A]]');
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await writeFile(join(root, 'Ref.md'), '[[Inbox/A]] external edit');
    await expect(coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' })).rejects.toThrow('preflight');
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toContain('external edit');
    await expect(access(join(root, 'Inbox/A.md'))).resolves.toBeUndefined();
  });

  it("preserves protected notes, ambiguous targets, examples and invalid UTF-8", async () => {
    for (const directory of ['01_受信箱', '40_情報源', '50_履歴', 'Other']) {
      await mkdir(join(root, directory));
      await writeFile(join(root, directory, 'A.md'), '[[Inbox/A]]');
    }
    const examples = '\uFEFF---\r\nref: "[[Inbox/A|表示]]" # [[Inbox/A]]\r\n---\r\n[[A]]\r\n<!-- [[Inbox/A]] [x](Inbox/A.md) -->\r\n`[[Inbox/A]]`\r\n\r\n    [[Inbox/A]]\r\n\r\n\\[[Inbox/A]]\r\n```md\r\n[[Inbox/A]]\r\n```\r\n';
    await writeFile(join(root, 'Examples.md'), examples);
    const invalid = Buffer.concat([Buffer.from('[[Inbox/A]] '), Buffer.from([0xf0, 0x90, 0x80])]);
    await writeFile(join(root, 'Invalid.md'), invalid);
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    for (const directory of ['01_受信箱', '40_情報源', '50_履歴']) {
      expect(await readFile(join(root, directory, 'A.md'), 'utf8')).toBe('[[Inbox/A]]');
    }
    expect(await readFile(join(root, 'Examples.md'), 'utf8')).toBe(examples.replace('[[Inbox/A|表示]]', '[[Archive/B|表示]]'));
    expect(await readFile(join(root, 'Invalid.md'))).toEqual(invalid);
  });

  it("retains an external edit and the recovery journal during a partial link update", async () => {
    await writeFile(join(root, 'Ref1.md'), '[[Inbox/A]]');
    await writeFile(join(root, 'Ref2.md'), '[[Inbox/A]]');
    const raced = new EntryMoveCoordinator({ vault, drive: {
      inspectLocalMoves: async () => ({ tracked: 1, untracked: 0, pendingMoves: { ...pendingMoves } }),
      recordLocalMoves, replacePendingMoves,
    }, afterJournalStage: async stage => {
      if (stage === 'links') {
        await writeFile(join(root, 'Ref2.md'), 'external edit');
        throw new Error('injected failure');
      }
    }});
    const plan = await raced.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await expect(raced.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' })).rejects.toThrow('RECOVERY_REQUIRED');
    expect(await readFile(join(root, 'Ref2.md'), 'utf8')).toBe('external edit');
    expect((await coordinator.recover()).status).toBe('recovery-required');
    await expect(access(join(root, 'Archive/B.md'))).resolves.toBeUndefined();
    await expect(access(join(root, '.tsuzune/pending-entry-move.json'))).resolves.toBeUndefined();
  });

  it("rewrites relative Markdown destinations, encoded names and definitions only", async () => {
    const original = '[表示](../Inbox/A.md#見出し "[[Inbox/A]]")\r\n![embed](<../Inbox/A.md#^id>)\r\n[x][id]\r\n\r\n[id]: ../Inbox/A.md "title"\r\n[remote](https://example.com/Inbox/A.md)\r\n';
    await writeFile(join(root, 'Other.md'), '[root](/Inbox/A.md#fragment)');
    await writeFile(join(root, 'Archive/Ref.md'), original);
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/新 名.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    expect(await readFile(join(root, 'Archive/Ref.md'), 'utf8')).toBe(original.replaceAll('../Inbox/A.md', '%E6%96%B0%20%E5%90%8D.md'));
    expect(await readFile(join(root, 'Other.md'), 'utf8')).toBe('[root](/Archive/%E6%96%B0%20%E5%90%8D.md#fragment)');
  });

  it("rejects a rename whose destination cannot be represented by existing Wiki links", async () => {
    await writeFile(join(root, 'Ref.md'), '[[Inbox/A]]');
    await expect(coordinator.preflight('Inbox/A.md', 'Archive/B#C.md', 'human')).rejects.toThrow('Wiki');
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe('[[Inbox/A]]');
    await expect(access(join(root, 'Inbox/A.md'))).resolves.toBeUndefined();
  });

  it("does not rewrite YAML comments after plain apostrophes or quoted property keys", async () => {
    const original = '---\nowner: O\'Brien # [[Inbox/A]]\n"[[Inbox/A]]": untouched\nref: "[[Inbox/A]]"\n---\n';
    await writeFile(join(root, 'Ref.md'), original);
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe(original.replace('ref: "[[Inbox/A]]"', 'ref: "[[Archive/B]]"'));
  });

  it("refuses to break a quoted YAML link value with the new filename", async () => {
    await writeFile(join(root, 'Ref.md'), "---\nref: '[[Inbox/A]]'\n---\n");
    await expect(coordinator.preflight('Inbox/A.md', "Archive/O'Brien.md", 'human')).rejects.toThrow('YAML');
    await expect(access(join(root, 'Inbox/A.md'))).resolves.toBeUndefined();
  });

  it("preserves self-link bytes when a note enters the protected source area", async () => {
    await mkdir(join(root, '40_情報源'));
    await writeFile(join(root, 'Inbox/A.md'), '[[Inbox/A]]');
    await writeFile(join(root, 'Ref.md'), '[[Inbox/A]]');
    const plan = await coordinator.preflight('Inbox/A.md', '40_情報源/A.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    expect(await readFile(join(root, '40_情報源/A.md'), 'utf8')).toBe('[[Inbox/A]]');
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe('[[40_情報源/A]]');
  });

  it("leaves Wiki-looking text in external and custom-scheme URLs untouched", async () => {
    const original = '[remote](https://example.test/[[Inbox/A]])\n[custom](app:route/[[Inbox/A]])\n[[Inbox/A]]';
    await writeFile(join(root, 'Ref.md'), original);
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/B.md', 'human');
    await coordinator.apply({ source: plan.source, destination: plan.destination,
      expected_fingerprint: plan.fingerprint, actor: 'human' });
    expect(await readFile(join(root, 'Ref.md'), 'utf8')).toBe(original.replace(/\[\[Inbox\/A\]\]$/, '[[Archive/B]]'));
  });

  it("trashes only an unlinked Inbox source at its exact revision", async () => {
    await vault.createDirectory({ parent: "", name: "01_受信箱" });
    await vault.createNote({
      directory: "01_受信箱",
      name: "原典",
      content: "# 原典\n\n本文",
    });
    const note = await vault.readNote("01_受信箱/原典.md");
    const digest = createHash("sha256")
      .update(root)
      .update("\0")
      .update(note.path)
      .update("\0")
      .update(String(note.modifiedAt))
      .update("\0")
      .update(String(note.size))
      .update("\0")
      .update(note.content);
    const sourceRevision = `sha256:${digest.digest("hex")}`;

    await expect(
      coordinator.trash({
        source: "01_受信箱/原典.md",
        expected_revision: "sha256:stale",
        actor: "ai",
      }),
    ).rejects.toThrow("revision");

    const result = await coordinator.trash({
      source: "01_受信箱/原典.md",
      expected_revision: sourceRevision,
      actor: "ai",
    });

    expect(result).toMatchObject({
      old_path: "01_受信箱/原典.md",
      source_revision: sourceRevision,
    });
    expect(result.new_path).toMatch(/^\.trash\//);
    await expect(access(join(root, "01_受信箱", "原典.md"))).rejects.toBeDefined();
  });

  it("refuses to trash an Inbox source while Wiki-link backlinks remain", async () => {
    await vault.createDirectory({ parent: "", name: "01_受信箱" });
    await vault.createNote({
      directory: "01_受信箱",
      name: "参照あり",
      content: "# 参照あり",
    });
    await vault.createNote({
      directory: "",
      name: "参照元",
      content: "[[参照あり|表示名]]",
    });
    const note = await vault.readNote("01_受信箱/参照あり.md");
    const digest = createHash("sha256")
      .update(root)
      .update("\0")
      .update(note.path)
      .update("\0")
      .update(String(note.modifiedAt))
      .update("\0")
      .update(String(note.size))
      .update("\0")
      .update(note.content);

    await expect(
      coordinator.trash({
        source: note.path,
        expected_revision: `sha256:${digest.digest("hex")}`,
        actor: "ai",
      }),
    ).rejects.toThrow("リンク元");
  });

  it("refuses to trash a note outside the Inbox", async () => {
    const note = await vault.readNote("Inbox/A.md");
    const digest = createHash("sha256")
      .update(root)
      .update("\0")
      .update(note.path)
      .update("\0")
      .update(String(note.modifiedAt))
      .update("\0")
      .update(String(note.size))
      .update("\0")
      .update(note.content);

    await expect(
      coordinator.trash({
        source: note.path,
        expected_revision: `sha256:${digest.digest("hex")}`,
        actor: "ai",
      }),
    ).rejects.toThrow("01_受信箱");
  });

  it("rechecks the source revision immediately before the trash rename", async () => {
    await vault.createDirectory({ parent: "", name: "01_受信箱" });
    await vault.createNote({
      directory: "01_受信箱",
      name: "競合",
      content: "# 競合\n\n元本文",
    });
    const note = await vault.readNote("01_受信箱/競合.md");
    const digest = createHash("sha256")
      .update(root)
      .update("\0")
      .update(note.path)
      .update("\0")
      .update(String(note.modifiedAt))
      .update("\0")
      .update(String(note.size))
      .update("\0")
      .update(note.content);
    const originalTrash = vault.trashEntry.bind(vault);
    vi.spyOn(vault, "trashEntry").mockImplementationOnce(
      async (path, beforeRename) => {
        await writeFile(join(root, "01_受信箱", "競合.md"), "# 競合\n\n変更後");
        return originalTrash(path, beforeRename);
      },
    );

    await expect(
      coordinator.trash({
        source: note.path,
        expected_revision: `sha256:${digest.digest("hex")}`,
        actor: "ai",
      }),
    ).rejects.toThrow("revision");
    await expect(readFile(join(root, "01_受信箱", "競合.md"), "utf8"))
      .resolves.toContain("変更後");
  });

  it("refuses to trash a non-Markdown Inbox entry", async () => {
    await expect(
      coordinator.trash({
        source: "01_受信箱/image.png",
        expected_revision: `sha256:${"0".repeat(64)}`,
        actor: "ai",
      }),
    ).rejects.toThrow("Markdown");
  });

  it("restores a Drive ledger that changed before its writer failed", async () => {
    recordLocalMoves.mockImplementationOnce(async (mappings) => {
      for (const mapping of mappings) {
        pendingMoves[mapping.oldPath] = mapping.path;
      }
      throw new Error("LEDGER_WRITE_FAILED_AFTER_COMMIT");
    });
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
      }),
    ).rejects.toThrow("LEDGER_WRITE_FAILED_AFTER_COMMIT");

    expect(pendingMoves).toEqual({});
    expect(replacePendingMoves).toHaveBeenCalledWith({});
    await expect(access(join(root, "Inbox", "A.md"))).resolves.toBeUndefined();
    await expect(access(join(root, "Archive", "A.md"))).rejects.toBeDefined();
  });

  it("does not create history during a move", async () => {
    const plan = await coordinator.preflight(
      "Inbox/A.md",
      "Archive/A.md",
      "ai",
    );
    await expect(coordinator.apply({
        source: plan.source,
        destination: plan.destination,
        expected_fingerprint: plan.fingerprint,
        actor: "ai",
      })).resolves.not.toHaveProperty("history_path");
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
        source: plan.source,
        destination: plan.destination,
        fingerprint: plan.fingerprint,
        content_revision: `sha256:${digest.digest("hex")}`,
        drive_tracked: true,
        pending_moves_before: {},
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
      action: "committed",
    });
    await expect(access(join(root, "Inbox", "A.md"))).rejects.toBeDefined();
    await expect(access(join(root, "Archive", "A.md"))).resolves.toBeUndefined();
    expect(pendingMoves).toEqual({ "Inbox/A.md": "Archive/A.md" });
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
        source: plan.source,
        destination: plan.destination,
        fingerprint: plan.fingerprint,
        content_revision: `sha256:${digest.digest("hex")}`,
        drive_tracked: true,
        pending_moves_before: {},
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
      ["ledger", "committed"],
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

  it("recovers interrupted human moves with partially rewritten links and self links", async () => {
    for (const stage of ['prepared', 'filesystem', 'links', 'ledger']) {
      const crashRoot = await mkdtemp(join(tmpdir(), `tsuzune-link-crash-${stage}-`));
      const crashVault = new VaultService();
      await crashVault.setRootPath(crashRoot);
      await mkdir(join(crashRoot, 'Inbox'));
      await mkdir(join(crashRoot, 'Archive'));
      const original = '\uFEFF# A\r\n[[Inbox/A]]\r\n';
      await writeFile(join(crashRoot, 'Inbox/A.md'), original);
      await writeFile(join(crashRoot, 'Ref.md'), '[[Inbox/A]]');
      await writeFile(join(crashRoot, 'drive-pending.json'), '{}');
      expect(await runCrashChild(crashRoot, stage, 'human')).toBe(1);
      const ledgerPath = join(crashRoot, 'drive-pending.json');
      const recovered = new EntryMoveCoordinator({ vault: crashVault, drive: {
        inspectLocalMoves: async () => ({ tracked: 1, untracked: 0, pendingMoves: JSON.parse(await readFile(ledgerPath, 'utf8')) }),
        recordLocalMoves: async () => undefined,
        replacePendingMoves: async (replacement) => writeFile(ledgerPath, JSON.stringify(replacement)),
      }});
      expect(await recovered.recover()).toEqual({ status: 'recovered',
        action: stage === 'prepared' ? 'discarded' : stage === 'ledger' ? 'committed' : 'rolled-back' });
      const committed = stage === 'ledger';
      expect(await readFile(join(crashRoot, committed ? 'Archive/A.md' : 'Inbox/A.md'), 'utf8'))
        .toBe(committed ? original.replace('Inbox/A', 'Archive/A') : original);
      expect(await readFile(join(crashRoot, 'Ref.md'), 'utf8')).toBe(committed ? '[[Archive/A]]' : '[[Inbox/A]]');
      expect(await recovered.recover()).toEqual({ status: 'clean' });
    }
  }, 60_000);
});
