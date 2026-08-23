import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyDrivePathAliasRelocationPrototype,
  previewDrivePathAliasRelocationPrototype,
  type DriveMarkdownRelocationRemote,
  type RemoteRelocationMarkdownObject,
} from "../src/cli/drive-path-alias-relocation-prototype";
import type {
  DrivePathAliasRemote,
  RemotePathAliasObject,
} from "../src/cli/drive-path-alias-sync-prototype";
import {
  parseClassificationMigrationPlan,
  type ClassificationMigrationPlan,
} from "../src/cli/classification-migration-preview";

const sourcePath = "30_知識/旧ノート.md";
const destinationPath = "30_知識/ソフトウェア開発/旧ノート.md";
const auditPath = "40_情報源/分類監査.md";
const activePath = "10_プロジェクト/利用中.md";
const historyPath = "50_履歴/過去記録.md";
const otherPath = "30_知識/別ノート.md";
const sidecarPath = ".tsuzune/path-aliases.json";
const ownershipPath = ".tsuzune/o2-p3-owned.json";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeVaultFile(
  vaultRoot: string,
  path: string,
  content: string | Buffer,
): Promise<void> {
  const absolutePath = join(vaultRoot, ...path.split("/"));
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, content);
}

class MemoryRelocationRemote
  implements DriveMarkdownRelocationRemote, DrivePathAliasRemote
{
  readonly markdown: RemoteRelocationMarkdownObject[] = [];
  readonly aliases: RemotePathAliasObject[] = [];
  readonly operations: string[] = [];
  beforeRelocate: (() => Promise<void>) | null = null;
  beforeReverseRelocate: (() => Promise<void>) | null = null;
  rejectReverseRelocation = false;
  relocationResponseOnly = false;
  createResponseOnly = false;
  createAttemptFailsWithoutObject = false;

  async listMarkdown(): Promise<RemoteRelocationMarkdownObject[]> {
    return this.markdown.map((file) => ({ ...file }));
  }

  async relocateMarkdown(input: {
    fileId: string;
    vaultId: string;
    parentId: string;
    oldPath: string;
    newPath: string;
    expectedVersion: string;
    expectedContentHash: string;
  }): Promise<RemoteRelocationMarkdownObject> {
    await this.beforeRelocate?.();
    if (input.oldPath === destinationPath) await this.beforeReverseRelocate?.();
    if (this.rejectReverseRelocation && input.oldPath === destinationPath) {
      throw new Error("REMOTE_ROLLBACK_DRIFT");
    }
    const file = this.markdown.find(
      (candidate) => candidate.id === input.fileId,
    );
    if (
      !file ||
      file.vaultId !== input.vaultId ||
      file.parentId !== input.parentId ||
      file.path !== input.oldPath ||
      file.version !== input.expectedVersion ||
      file.contentHash !== input.expectedContentHash
    ) {
      throw new Error("REMOTE_RELOCATION_DRIFT");
    }
    if (this.relocationResponseOnly) {
      return {
        ...file,
        path: input.newPath,
        name: basename(input.newPath),
        version: String(Number(file.version) + 1),
      };
    }
    file.path = input.newPath;
    file.name = basename(input.newPath);
    file.version = String(Number(file.version) + 1);
    this.operations.push(`relocate:${input.oldPath}->${input.newPath}`);
    return { ...file };
  }

  async list(): Promise<RemotePathAliasObject[]> {
    return this.aliases.map((file) => ({
      ...file,
      bytes: Buffer.from(file.bytes),
    }));
  }

  async create(input: {
    vaultId: string;
    parentId: string;
    bytes: Buffer;
  }): Promise<RemotePathAliasObject> {
    if (!this.createResponseOnly) throw new Error("UNEXPECTED_ALIAS_CREATE");
    if (this.createAttemptFailsWithoutObject) {
      throw new Error("REMOTE_ALIAS_CREATE_NO_OBJECT");
    }
    const file: RemotePathAliasObject = {
      id: "remote-alias-created",
      vaultId: input.vaultId,
      role: "pathAliases",
      parentId: input.parentId,
      version: "1",
      bytes: Buffer.from(input.bytes),
    };
    this.aliases.push(file);
    this.operations.push("alias-create");
    throw new Error("REMOTE_ALIAS_CREATE_RESPONSE_LOST");
  }

  async update(input: {
    fileId: string;
    vaultId: string;
    parentId: string;
    expectedVersion: string;
    bytes: Buffer;
  }): Promise<RemotePathAliasObject> {
    const file = this.aliases.find(
      (candidate) => candidate.id === input.fileId,
    );
    if (!file || file.version !== input.expectedVersion) {
      throw new Error("REMOTE_ALIAS_DRIFT");
    }
    file.bytes = Buffer.from(input.bytes);
    file.version = String(Number(file.version) + 1);
    this.operations.push("alias-update");
    return { ...file, bytes: Buffer.from(file.bytes) };
  }

  async remove(input: {
    fileId: string;
    vaultId: string;
    parentId: string;
    expectedVersion: string;
  }): Promise<void> {
    const index = this.aliases.findIndex(
      (candidate) =>
        candidate.id === input.fileId &&
        candidate.vaultId === input.vaultId &&
        candidate.parentId === input.parentId &&
        candidate.version === input.expectedVersion,
    );
    if (index < 0) throw new Error("REMOTE_ALIAS_REMOVE_DRIFT");
    this.aliases.splice(index, 1);
    this.operations.push("alias-remove");
  }
}

async function fixture(): Promise<{
  root: string;
  vaultRoot: string;
  ownershipToken: string;
  preimagesDirectory: string;
  recoveryPacketPath: string;
  driveLedgerPath: string;
  aliasLedgerPath: string;
  plan: ClassificationMigrationPlan;
  remote: MemoryRelocationRemote;
  sourceBytes: Buffer;
}> {
  const root = await mkdtemp(join(tmpdir(), "tsuzune-o2-p4b-"));
  temporaryRoots.push(root);
  const vaultRoot = join(root, "vault");
  const preimagesDirectory = join(root, "preimages");
  await Promise.all([
    mkdir(vaultRoot, { recursive: true }),
    mkdir(preimagesDirectory, { recursive: true }),
  ]);
  const ownershipToken = randomUUID();
  const sourceBytes = Buffer.from("# 旧ノート\n\n本文\n", "utf8");
  const auditBytes = Buffer.from(
    "# 分類監査\n\n[[30_知識/旧ノート]]\n",
    "utf8",
  );
  const sidecarBytes = Buffer.from(
    '{"過去/旧パス.md":"30_知識/別ノート.md"}\n',
    "utf8",
  );
  const contents: Record<string, string | Buffer> = {
    [sourcePath]: sourceBytes,
    [auditPath]: auditBytes,
    [historyPath]: "# 過去記録\n\n[[30_知識/旧ノート]]\n",
    [activePath]: [
      "# 利用中",
      "",
      "[[30_知識/旧ノート]]",
      "[[30_知識/旧ノート#判断|表示名]]",
      "[[30_知識/旧ノート.md]]",
      "[[旧ノート]]",
      "[[30_知識/別ノート]]",
    ].join("\n"),
    [otherPath]: "# 別ノート\n",
    [ownershipPath]: `${JSON.stringify({ token: ownershipToken })}\n`,
    [sidecarPath]: sidecarBytes,
  };
  for (const [path, content] of Object.entries(contents)) {
    await writeVaultFile(vaultRoot, path, content);
  }
  const plan = parseClassificationMigrationPlan({
    schemaVersion: 1,
    planId: "o2-p4b-fixture",
    analysisAsOf: "2026-08-13T00:00:00.000Z",
    auditSource: {
      path: auditPath,
      expectedSizeBytes: auditBytes.length,
      expectedSha256: sha256(auditBytes),
    },
    moves: [
      {
        sourcePath,
        destinationPath,
        expectedSizeBytes: sourceBytes.length,
        expectedSha256: sha256(sourceBytes),
        expectedReferences: {
          active: 4,
          source: 1,
          history: 1,
          mcpBacklinks: 3,
        },
      },
    ],
  });
  const remote = new MemoryRelocationRemote();
  const contentHash = sha256(sourceBytes);
  remote.markdown.push({
    id: "remote-note-1",
    vaultId: "vault-1",
    path: sourcePath,
    name: basename(sourcePath),
    parentId: "root-1",
    version: "5",
    contentHash,
  });
  remote.aliases.push({
    id: "remote-alias-1",
    vaultId: "vault-1",
    role: "pathAliases",
    parentId: "root-1",
    version: "2",
    bytes: sidecarBytes,
  });
  const driveLedgerPath = join(root, "drive-ledger.json");
  await writeFile(
    driveLedgerPath,
    JSON.stringify({
      version: 1,
      vaults: [
        {
          rootPath: vaultRoot,
          vaultId: "vault-1",
          rootFolderId: "root-1",
          lastSyncAt: null,
          files: {
            [sourcePath]: {
              fileId: "remote-note-1",
              localHash: contentHash,
              remoteHash: contentHash,
            },
          },
        },
      ],
    }),
    "utf8",
  );
  const aliasLedgerPath = join(root, "alias-ledger.json");
  await writeFile(
    aliasLedgerPath,
    JSON.stringify({
      kind: "o2-p4a-path-alias-ledger",
      version: 1,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      fileId: "remote-alias-1",
      localHash: sha256(sidecarBytes),
      remoteHash: sha256(sidecarBytes),
      remoteVersion: "2",
    }),
    "utf8",
  );
  return {
    root,
    vaultRoot,
    ownershipToken,
    preimagesDirectory,
    recoveryPacketPath: join(root, "o2-p4b-recovery.json"),
    driveLedgerPath,
    aliasLedgerPath,
    plan,
    remote,
    sourceBytes,
  };
}

describe("O2-P4B Drive Path Alias relocation prototype", () => {
  it("relocates only the explicit plan while preserving file ID, content, and parent", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);

    expect(preview.moves).toEqual([
      {
        fileId: "remote-note-1",
        sourcePath,
        destinationPath,
        version: "5",
        contentHash: sha256(setup.sourceBytes),
      },
    ]);
    await applyDrivePathAliasRelocationPrototype({ ...options, preview });

    expect(setup.remote.markdown).toEqual([
      {
        id: "remote-note-1",
        vaultId: "vault-1",
        path: destinationPath,
        name: basename(destinationPath),
        parentId: "root-1",
        version: "6",
        contentHash: sha256(setup.sourceBytes),
      },
    ]);
    expect(setup.remote.operations).toEqual([
      `relocate:${sourcePath}->${destinationPath}`,
      "alias-update",
    ]);
    expect(
      await readFile(join(setup.vaultRoot, ...destinationPath.split("/"))),
    ).toEqual(setup.sourceBytes);
    const ledger = JSON.parse(await readFile(setup.driveLedgerPath, "utf8"));
    expect(ledger.vaults[0].files[sourcePath]).toBeUndefined();
    expect(ledger.vaults[0].files[destinationPath]).toEqual({
      fileId: "remote-note-1",
      localHash: sha256(setup.sourceBytes),
      remoteHash: sha256(setup.sourceBytes),
    });
    await expect(readFile(setup.recoveryPacketPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("records the local rollback packet path before the first remote mutation", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.beforeRelocate = async () => {
      const recovery = JSON.parse(
        await readFile(setup.recoveryPacketPath, "utf8"),
      );
      expect(recovery.localRollbackPacketPath).toBe(
        join(setup.preimagesDirectory, `${setup.plan.planId}.rollback.json`),
      );
      expect(
        JSON.parse(await readFile(recovery.localRollbackPacketPath, "utf8")),
      ).toMatchObject({
        planId: setup.plan.planId,
      });
    };

    await applyDrivePathAliasRelocationPrototype({ ...options, preview });
  });

  it.each(["remote", "alias", "ledger"] as const)(
    "restores local and remote state when relocation fails after %s mutation",
    async (failAfter) => {
      const setup = await fixture();
      const options = {
        ...setup,
        vaultId: "vault-1",
        rootFolderId: "root-1",
        aliasRemote: setup.remote,
        markdownRemote: setup.remote,
      };
      const driveLedgerBefore = await readFile(setup.driveLedgerPath);
      const aliasLedgerBefore = await readFile(setup.aliasLedgerPath);
      const aliasBefore = Buffer.from(setup.remote.aliases[0]!.bytes);
      const preview = await previewDrivePathAliasRelocationPrototype(options);

      await expect(
        applyDrivePathAliasRelocationPrototype({
          ...options,
          preview,
          failAfter,
        }),
      ).rejects.toThrow(`O2_P4B_FAIL_AFTER_${failAfter.toUpperCase()}`);

      expect(
        await readFile(join(setup.vaultRoot, ...sourcePath.split("/"))),
      ).toEqual(setup.sourceBytes);
      await expect(
        readFile(join(setup.vaultRoot, ...destinationPath.split("/"))),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(setup.remote.markdown[0]).toMatchObject({
        id: "remote-note-1",
        path: sourcePath,
        parentId: "root-1",
        contentHash: sha256(setup.sourceBytes),
      });
      expect(setup.remote.aliases[0]!.bytes).toEqual(aliasBefore);
      expect(await readFile(setup.driveLedgerPath)).toEqual(driveLedgerBefore);
      expect(await readFile(setup.aliasLedgerPath)).toEqual(aliasLedgerBefore);
      await expect(readFile(setup.recoveryPacketPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("rejects a remote destination collision before mutation", async () => {
    const setup = await fixture();
    setup.remote.markdown.push({
      ...setup.remote.markdown[0]!,
      id: "remote-collision",
      path: destinationPath,
      name: basename(destinationPath),
      version: "1",
    });
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };

    await expect(
      previewDrivePathAliasRelocationPrototype(options),
    ).rejects.toThrow(`Remote destination collision: ${destinationPath}`);
    expect(setup.remote.operations).toEqual([]);
    expect(
      await readFile(join(setup.vaultRoot, ...sourcePath.split("/"))),
    ).toEqual(setup.sourceBytes);
  });

  it("rejects remote name drift before mutation", async () => {
    const setup = await fixture();
    setup.remote.markdown[0]!.name = "drifted.md";
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };

    await expect(
      previewDrivePathAliasRelocationPrototype(options),
    ).rejects.toThrow(`Paired source drift: ${sourcePath}`);
    expect(setup.remote.operations).toEqual([]);
  });

  it("rejects remote version drift after preview before mutation", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.markdown[0]!.version = "6";

    await expect(
      applyDrivePathAliasRelocationPrototype({ ...options, preview }),
    ).rejects.toThrow("O2-P4B state changed after preview.");
    expect(setup.remote.operations).toEqual([]);
    expect(
      await readFile(join(setup.vaultRoot, ...sourcePath.split("/"))),
    ).toEqual(setup.sourceBytes);
  });

  it("does not infer an unplanned move from equal content", async () => {
    const setup = await fixture();
    setup.remote.markdown.push({
      ...setup.remote.markdown[0]!,
      id: "remote-unplanned",
      path: "30_知識/未計画.md",
      name: "未計画.md",
      version: "9",
    });
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);

    await applyDrivePathAliasRelocationPrototype({ ...options, preview });

    expect(
      setup.remote.markdown.find((file) => file.id === "remote-unplanned"),
    ).toMatchObject({
      path: "30_知識/未計画.md",
      name: "未計画.md",
      version: "9",
    });
  });

  it("retains the recovery packet and blocks success when remote rollback drifts", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.rejectReverseRelocation = true;

    await expect(
      applyDrivePathAliasRelocationPrototype({
        ...options,
        preview,
        failAfter: "remote",
      }),
    ).rejects.toThrow("O2-P4B rollback incomplete; recovery packet retained");

    const recovery = JSON.parse(
      await readFile(setup.recoveryPacketPath, "utf8"),
    );
    expect(recovery.unresolved).toEqual(["remote:remote-note-1"]);
    expect(setup.remote.markdown[0]).toMatchObject({ path: destinationPath });
    await expect(
      previewDrivePathAliasRelocationPrototype(options),
    ).rejects.toThrow("Unresolved O2-P4B recovery packet exists.");
  });

  it("re-reads remote state before reporting completion", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.relocationResponseOnly = true;

    await expect(
      applyDrivePathAliasRelocationPrototype({ ...options, preview }),
    ).rejects.toThrow("Remote relocation completion verification failed.");
  });

  it("does not retain a false alias recovery when remote relocation fails before alias creation", async () => {
    const setup = await fixture();
    setup.remote.aliases.splice(0);
    await Promise.all([
      rm(setup.aliasLedgerPath),
      rm(join(setup.vaultRoot, ...sidecarPath.split("/"))),
    ]);
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.beforeRelocate = async () => {
      setup.remote.beforeRelocate = null;
      throw new Error("REMOTE_PRIMARY_FAILURE");
    };

    await expect(
      applyDrivePathAliasRelocationPrototype({ ...options, preview }),
    ).rejects.toThrow("REMOTE_PRIMARY_FAILURE");
    await expect(readFile(setup.recoveryPacketPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(setup.remote.aliases).toEqual([]);
    expect(
      await readFile(join(setup.vaultRoot, ...sourcePath.split("/"))),
    ).toEqual(setup.sourceBytes);
  });

  it("rolls back an alias created before the remote create response is lost", async () => {
    const setup = await fixture();
    setup.remote.aliases.splice(0);
    await Promise.all([
      rm(setup.aliasLedgerPath),
      rm(join(setup.vaultRoot, ...sidecarPath.split("/"))),
    ]);
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.createResponseOnly = true;

    await expect(
      applyDrivePathAliasRelocationPrototype({ ...options, preview }),
    ).rejects.toThrow("REMOTE_ALIAS_CREATE_RESPONSE_LOST");
    expect(setup.remote.aliases).toEqual([]);
    await expect(readFile(setup.recoveryPacketPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(
      await readFile(join(setup.vaultRoot, ...sourcePath.split("/"))),
    ).toEqual(setup.sourceBytes);
  });

  it("retains recovery when an attempted alias create is not yet visible", async () => {
    const setup = await fixture();
    setup.remote.aliases.splice(0);
    await Promise.all([
      rm(setup.aliasLedgerPath),
      rm(join(setup.vaultRoot, ...sidecarPath.split("/"))),
    ]);
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.createResponseOnly = true;
    setup.remote.createAttemptFailsWithoutObject = true;

    await expect(
      applyDrivePathAliasRelocationPrototype({ ...options, preview }),
    ).rejects.toThrow("O2-P4B rollback incomplete; recovery packet retained");
    const recovery = JSON.parse(
      await readFile(setup.recoveryPacketPath, "utf8"),
    );
    expect(recovery.unresolved).toContain("alias:created-not-found");
    expect(recovery.aliasCreateAttempted).toBe(true);
  });

  it("retains the recovery packet when local rollback reports unrestored paths", async () => {
    const setup = await fixture();
    const options = {
      ...setup,
      vaultId: "vault-1",
      rootFolderId: "root-1",
      aliasRemote: setup.remote,
      markdownRemote: setup.remote,
    };
    const preview = await previewDrivePathAliasRelocationPrototype(options);
    setup.remote.beforeReverseRelocate = async () => {
      await writeFile(
        join(setup.vaultRoot, ...destinationPath.split("/")),
        "# external local drift\n",
      );
    };

    await expect(
      applyDrivePathAliasRelocationPrototype({
        ...options,
        preview,
        failAfter: "remote",
      }),
    ).rejects.toThrow("O2-P4B rollback incomplete; recovery packet retained");

    const recovery = JSON.parse(
      await readFile(setup.recoveryPacketPath, "utf8"),
    );
    expect(recovery.unresolved).toContain(`local:${sourcePath}`);
  });
});
