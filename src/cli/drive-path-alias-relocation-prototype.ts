/**
 * O2-P4B test-only coordinator for explicit Drive metadata relocation.
 * No app, IPC, MCP, package command, OAuth, or live-Drive entry point uses it.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import {
  applyClassificationMigrationPrototype,
  rollbackClassificationMigrationPrototype,
  type ClassificationMigrationPrototypeOptions,
} from "./classification-migration-prototype";
import type { ClassificationMigrationPlan } from "./classification-migration-preview";
import {
  previewDrivePathAliasSyncPrototype,
  type DrivePathAliasRemote,
  type RemotePathAliasObject,
} from "./drive-path-alias-sync-prototype";

export interface RemoteRelocationMarkdownObject {
  id: string;
  vaultId: string;
  path: string;
  name: string;
  parentId: string;
  version: string;
  contentHash: string;
}

export interface DriveMarkdownRelocationRemote {
  listMarkdown(vaultId: string): Promise<RemoteRelocationMarkdownObject[]>;
  relocateMarkdown(input: {
    fileId: string;
    vaultId: string;
    parentId: string;
    oldPath: string;
    newPath: string;
    expectedVersion: string;
    expectedContentHash: string;
  }): Promise<RemoteRelocationMarkdownObject>;
}

interface LedgerFile {
  fileId: string;
  localHash: string;
  remoteHash: string;
}

interface DriveLedgerVault {
  rootPath: string;
  vaultId: string;
  rootFolderId: string | null;
  lastSyncAt: string | null;
  files: Record<string, LedgerFile>;
}

interface DriveLedger {
  version: 1;
  vaults: DriveLedgerVault[];
}

interface RelocationOptions {
  vaultRoot: string;
  ownershipToken: string;
  preimagesDirectory: string;
  recoveryPacketPath: string;
  driveLedgerPath: string;
  aliasLedgerPath: string;
  plan: ClassificationMigrationPlan;
  vaultId: string;
  rootFolderId: string;
  aliasRemote: DrivePathAliasRemote;
  markdownRemote: DriveMarkdownRelocationRemote;
  failAfter?: "remote" | "alias" | "ledger";
}

export interface DrivePathAliasRelocationPreview {
  fingerprint: string;
  moves: Array<{
    fileId: string;
    sourcePath: string;
    destinationPath: string;
    version: string;
    contentHash: string;
  }>;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function pathKey(path: string): string {
  return path.toLocaleLowerCase();
}

function assertOutsideVault(
  vaultRoot: string,
  candidate: string,
  label: string,
): void {
  const fromVault = relative(resolve(vaultRoot), resolve(candidate));
  if (!fromVault.startsWith("..") && !isAbsolute(fromVault)) {
    throw new Error(`${label} must be outside the Vault.`);
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function writeBytesAtomic(path: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseDriveLedger(value: unknown): DriveLedger {
  if (!value || typeof value !== "object")
    throw new Error("Drive ledger is invalid.");
  const ledger = value as Partial<DriveLedger>;
  if (ledger.version !== 1 || !Array.isArray(ledger.vaults)) {
    throw new Error("Drive ledger is invalid.");
  }
  return ledger as DriveLedger;
}

async function readDriveLedger(path: string): Promise<{
  bytes: Buffer;
  value: DriveLedger;
}> {
  const bytes = await readFile(path);
  return { bytes, value: parseDriveLedger(JSON.parse(bytes.toString("utf8"))) };
}

function selectLedgerVault(
  ledger: DriveLedger,
  options: RelocationOptions,
): DriveLedgerVault {
  const vault = ledger.vaults.find(
    (candidate) =>
      candidate.vaultId === options.vaultId &&
      candidate.rootFolderId === options.rootFolderId &&
      resolve(candidate.rootPath).toLowerCase() ===
        resolve(options.vaultRoot).toLowerCase(),
  );
  if (!vault || !vault.files || typeof vault.files !== "object") {
    throw new Error("Paired Drive ledger state is missing.");
  }
  return vault;
}

function selectAlias(
  aliases: RemotePathAliasObject[],
  options: RelocationOptions,
): RemotePathAliasObject {
  const owned = aliases.filter(
    (candidate) =>
      candidate.id &&
      candidate.version &&
      candidate.vaultId === options.vaultId &&
      candidate.parentId === options.rootFolderId &&
      candidate.role === "pathAliases",
  );
  if (owned.length !== 1)
    throw new Error("Owned remote Path Alias object is not unique.");
  return owned[0]!;
}

export async function previewDrivePathAliasRelocationPrototype(
  options: RelocationOptions,
): Promise<DrivePathAliasRelocationPreview> {
  assertOutsideVault(
    options.vaultRoot,
    options.recoveryPacketPath,
    "Recovery packet",
  );
  assertOutsideVault(
    options.vaultRoot,
    options.driveLedgerPath,
    "Drive ledger",
  );
  assertOutsideVault(
    options.vaultRoot,
    options.aliasLedgerPath,
    "Alias ledger",
  );
  try {
    await lstat(options.recoveryPacketPath);
    throw new Error("Unresolved O2-P4B recovery packet exists.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const aliasPreview = await previewDrivePathAliasSyncPrototype({
    vaultRoot: options.vaultRoot,
    sidecarPath: resolve(options.vaultRoot, ".tsuzune", "path-aliases.json"),
    ledgerPath: options.aliasLedgerPath,
    vaultId: options.vaultId,
    rootFolderId: options.rootFolderId,
    remote: options.aliasRemote,
  });
  if (aliasPreview.action !== "none") {
    throw new Error("O2-P4A baseline is not clean.");
  }

  const [{ bytes: ledgerBytes, value: ledger }, remoteFiles] =
    await Promise.all([
      readDriveLedger(options.driveLedgerPath),
      options.markdownRemote.listMarkdown(options.vaultId),
    ]);
  const ledgerVault = selectLedgerVault(ledger, options);
  const remoteByPath = new Map(
    remoteFiles.map((file) => [pathKey(file.path), file] as const),
  );
  const ledgerPaths = new Set(Object.keys(ledgerVault.files).map(pathKey));
  const moves: DrivePathAliasRelocationPreview["moves"] = [];

  for (const move of options.plan.moves) {
    if (
      remoteByPath.has(pathKey(move.destinationPath)) ||
      ledgerPaths.has(pathKey(move.destinationPath))
    ) {
      throw new Error(`Remote destination collision: ${move.destinationPath}`);
    }
    const localBytes = await readFile(
      resolve(options.vaultRoot, ...move.sourcePath.split("/")),
    );
    const contentHash = sha256(localBytes);
    if (
      localBytes.length !== move.expectedSizeBytes ||
      contentHash !== move.expectedSha256.toLowerCase()
    ) {
      throw new Error(`Local content drift: ${move.sourcePath}`);
    }
    const ledgerFile = ledgerVault.files[move.sourcePath];
    const remote = remoteByPath.get(pathKey(move.sourcePath));
    if (
      !ledgerFile ||
      !remote ||
      !remote.id ||
      !remote.version ||
      remote.id !== ledgerFile.fileId ||
      remote.vaultId !== options.vaultId ||
      remote.parentId !== options.rootFolderId ||
      remote.name !== basename(move.sourcePath) ||
      remote.contentHash !== contentHash ||
      ledgerFile.localHash !== contentHash ||
      ledgerFile.remoteHash !== contentHash
    ) {
      throw new Error(`Paired source drift: ${move.sourcePath}`);
    }
    moves.push({
      fileId: remote.id,
      sourcePath: move.sourcePath,
      destinationPath: move.destinationPath,
      version: remote.version,
      contentHash,
    });
  }

  return {
    moves,
    fingerprint: sha256(
      stableJson({
        plan: options.plan,
        moves,
        ledgerHash: sha256(ledgerBytes),
        aliasFingerprint: aliasPreview.fingerprint,
      }),
    ),
  };
}

export async function applyDrivePathAliasRelocationPrototype(
  options: RelocationOptions & { preview: DrivePathAliasRelocationPreview },
): Promise<void> {
  const fresh = await previewDrivePathAliasRelocationPrototype(options);
  if (fresh.fingerprint !== options.preview.fingerprint) {
    throw new Error("O2-P4B state changed after preview.");
  }

  const ledgerPreimage = await readFile(options.driveLedgerPath);
  const aliasLedgerPreimage = await readFile(options.aliasLedgerPath);
  const alias = selectAlias(
    await options.aliasRemote.list(options.vaultId),
    options,
  );
  const localRollbackPacketPath = resolve(
    options.preimagesDirectory,
    `${options.plan.planId}.rollback.json`,
  );
  const recovery = {
    schemaVersion: 1,
    kind: "o2-p4b-recovery-packet",
    planId: options.plan.planId,
    localRollbackPacketPath,
    remoteMarkdown: fresh.moves,
    remoteAlias: {
      fileId: alias.id,
      version: alias.version,
      bytesBase64: alias.bytes.toString("base64"),
    },
    ledgerPreimageBase64: ledgerPreimage.toString("base64"),
    aliasLedgerPreimageBase64: aliasLedgerPreimage.toString("base64"),
    completedRelocations: [] as Array<{
      fileId: string;
      oldPath: string;
      newPath: string;
      currentVersion: string;
    }>,
    aliasUpdatedVersion: null as string | null,
    unresolved: [] as string[],
  };
  await writeJsonAtomic(options.recoveryPacketPath, recovery);

  try {
    const localOptions: ClassificationMigrationPrototypeOptions = {
      vaultRoot: options.vaultRoot,
      plan: options.plan,
      ownershipToken: options.ownershipToken,
      preimagesDirectory: options.preimagesDirectory,
      rollbackPacketPath: localRollbackPacketPath,
    };
    const local = await applyClassificationMigrationPrototype(localOptions);

    for (const move of fresh.moves) {
      const relocated = await options.markdownRemote.relocateMarkdown({
        fileId: move.fileId,
        vaultId: options.vaultId,
        parentId: options.rootFolderId,
        oldPath: move.sourcePath,
        newPath: move.destinationPath,
        expectedVersion: move.version,
        expectedContentHash: move.contentHash,
      });
      if (
        relocated.id !== move.fileId ||
        relocated.path !== move.destinationPath ||
        relocated.parentId !== options.rootFolderId ||
        relocated.contentHash !== move.contentHash
      ) {
        throw new Error(
          `Remote relocation verification failed: ${move.fileId}`,
        );
      }
      recovery.completedRelocations.push({
        fileId: move.fileId,
        oldPath: move.sourcePath,
        newPath: move.destinationPath,
        currentVersion: relocated.version,
      });
      await writeJsonAtomic(options.recoveryPacketPath, recovery);
    }
    if (options.failAfter === "remote")
      throw new Error("O2_P4B_FAIL_AFTER_REMOTE");

    const aliasBytes = await readFile(
      resolve(options.vaultRoot, ".tsuzune", "path-aliases.json"),
    );
    const updatedAlias = await options.aliasRemote.update({
      fileId: alias.id,
      vaultId: options.vaultId,
      parentId: options.rootFolderId,
      expectedVersion: alias.version,
      bytes: aliasBytes,
    });
    if (
      updatedAlias.id !== alias.id ||
      updatedAlias.parentId !== options.rootFolderId ||
      !updatedAlias.bytes.equals(aliasBytes)
    ) {
      throw new Error("Remote alias verification failed.");
    }
    recovery.aliasUpdatedVersion = updatedAlias.version;
    await writeJsonAtomic(options.recoveryPacketPath, recovery);
    if (options.failAfter === "alias")
      throw new Error("O2_P4B_FAIL_AFTER_ALIAS");

    await writeJsonAtomic(options.aliasLedgerPath, {
      kind: "o2-p4a-path-alias-ledger",
      version: 1,
      vaultId: options.vaultId,
      rootFolderId: options.rootFolderId,
      fileId: updatedAlias.id,
      localHash: sha256(aliasBytes),
      remoteHash: sha256(updatedAlias.bytes),
      remoteVersion: updatedAlias.version,
    });

    const ledger = JSON.parse(ledgerPreimage.toString("utf8")) as DriveLedger;
    const ledgerVault = selectLedgerVault(ledger, options);
    for (const move of fresh.moves) {
      const entry = ledgerVault.files[move.sourcePath]!;
      delete ledgerVault.files[move.sourcePath];
      ledgerVault.files[move.destinationPath] = entry;
    }
    await writeJsonAtomic(options.driveLedgerPath, ledger);
    if (options.failAfter === "ledger")
      throw new Error("O2_P4B_FAIL_AFTER_LEDGER");

    const remoteAfter = await options.markdownRemote.listMarkdown(
      options.vaultId,
    );
    for (const move of fresh.moves) {
      const file = remoteAfter.find(
        (candidate) => candidate.id === move.fileId,
      );
      const entry = ledgerVault.files[move.destinationPath];
      if (
        !file ||
        file.vaultId !== options.vaultId ||
        file.path !== move.destinationPath ||
        file.name !== basename(move.destinationPath) ||
        file.parentId !== options.rootFolderId ||
        file.contentHash !== move.contentHash ||
        ledgerVault.files[move.sourcePath] ||
        !entry ||
        entry.fileId !== move.fileId ||
        entry.localHash !== move.contentHash ||
        entry.remoteHash !== move.contentHash
      ) {
        throw new Error("Remote relocation completion verification failed.");
      }
    }

    const verified = await previewDrivePathAliasSyncPrototype({
      vaultRoot: options.vaultRoot,
      sidecarPath: resolve(options.vaultRoot, ".tsuzune", "path-aliases.json"),
      ledgerPath: options.aliasLedgerPath,
      vaultId: options.vaultId,
      rootFolderId: options.rootFolderId,
      remote: options.aliasRemote,
    });
    if (verified.action !== "none") {
      throw new Error("Remote alias checkpoint verification failed.");
    }

    await rm(options.recoveryPacketPath, { force: true });
    await rm(local.rollbackPacketPath, { force: true });
  } catch (error) {
    const unresolved: string[] = [];
    const currentRemote = await options.markdownRemote
      .listMarkdown(options.vaultId)
      .catch(() => []);
    for (const completed of [...recovery.completedRelocations].reverse()) {
      const move = recovery.remoteMarkdown.find(
        (candidate) => candidate.fileId === completed.fileId,
      )!;
      const current = currentRemote.find(
        (candidate) => candidate.id === completed.fileId,
      );
      if (
        current?.path === completed.oldPath &&
        current.version === move.version &&
        current.contentHash === move.contentHash
      ) {
        continue;
      }
      try {
        const restored = await options.markdownRemote.relocateMarkdown({
          fileId: completed.fileId,
          vaultId: options.vaultId,
          parentId: options.rootFolderId,
          oldPath: completed.newPath,
          newPath: completed.oldPath,
          expectedVersion: completed.currentVersion,
          expectedContentHash: move.contentHash,
        });
        if (
          restored.id !== completed.fileId ||
          restored.path !== completed.oldPath
        ) {
          throw new Error("identity mismatch");
        }
      } catch {
        unresolved.push(`remote:${completed.fileId}`);
      }
    }
    if (recovery.aliasUpdatedVersion) {
      try {
        const restored = await options.aliasRemote.update({
          fileId: recovery.remoteAlias.fileId,
          vaultId: options.vaultId,
          parentId: options.rootFolderId,
          expectedVersion: recovery.aliasUpdatedVersion,
          bytes: Buffer.from(recovery.remoteAlias.bytesBase64, "base64"),
        });
        if (
          !restored.bytes.equals(
            Buffer.from(recovery.remoteAlias.bytesBase64, "base64"),
          )
        ) {
          throw new Error("bytes mismatch");
        }
      } catch {
        unresolved.push(`alias:${recovery.remoteAlias.fileId}`);
      }
    }
    try {
      await writeBytesAtomic(options.driveLedgerPath, ledgerPreimage);
    } catch {
      unresolved.push(`ledger:${options.driveLedgerPath}`);
    }
    try {
      await writeBytesAtomic(options.aliasLedgerPath, aliasLedgerPreimage);
    } catch {
      unresolved.push(`ledger:${options.aliasLedgerPath}`);
    }
    try {
      const local = await rollbackClassificationMigrationPrototype({
        vaultRoot: options.vaultRoot,
        rollbackPacketPath: localRollbackPacketPath,
        ownershipToken: options.ownershipToken,
      });
      unresolved.push(...local.unrestoredPaths.map((path) => `local:${path}`));
    } catch {
      unresolved.push(`local:${localRollbackPacketPath}`);
    }
    if (unresolved.length > 0) {
      recovery.unresolved = unresolved;
      await writeJsonAtomic(options.recoveryPacketPath, recovery);
      throw new Error(
        `O2-P4B rollback incomplete; recovery packet retained: ${unresolved.join(", ")}`,
      );
    }
    await rm(options.recoveryPacketPath, { force: true });
    await rm(localRollbackPacketPath, { force: true });
    throw error;
  }
}
