import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildWikiLinkIndex, findLinkImpact, getBacklinks } from "../core/links";
import { compilePathAliases } from "../core/path-aliases";
import { rewriteMovedLinks } from "../core/move-links";
import {
  dirnameRelative,
  validateRelativePath,
} from "../core/paths";
import {
  isAiMoveProtected,
  isAuditHistoryPath,
  isAiImmutablePath,
} from "../shared/ai-write-policy";
import type { NoteDocument } from "../shared/types";
import { VaultService } from "./vault";

export type EntryMoveActor = "human" | "ai";
export type EntryMoveJournalStage = "prepared" | "filesystem" | "links" | "ledger";
export type EntryMoveRecoveryStatus =
  | { status: "clean" }
  | { status: "recovered"; action: "discarded" | "rolled-back" | "committed" }
  | { status: "recovery-required"; source: string; destination: string };

export interface EntryMovePlan {
  source_type: "markdown";
  source: string;
  destination: string;
  fingerprint: string;
  source_revision: string;
  content_revision: string;
  counts: { markdown: 1; directories: 0; attachments: 0 };
  mappings: Array<{ old_path: string; new_path: string }>;
  mapping_truncated: false;
  collision: false;
  protected_source: boolean;
  protected_destination: boolean;
  link_impact: { affected_count: number; source_paths: string[] };
  drive: { tracked_moves: number; untracked_uploads: number };
}

export interface EntryMoveApplyInput {
  source: string;
  destination: string;
  expected_fingerprint: string;
  actor: EntryMoveActor;
}

export interface EntryMoveResult {
  old_path: string;
  new_path: string;
  fingerprint: string;
}

export interface EntryTrashApplyInput {
  source: string;
  expected_revision: string;
  actor: EntryMoveActor;
}

export interface EntryTrashResult {
  old_path: string;
  new_path: string;
  source_revision: string;
}

interface EntryMoveDrive {
  inspectLocalMoves(
    mappings: Array<{ oldPath: string; path: string }>,
  ): Promise<{
    tracked: number;
    untracked: number;
    pendingMoves: Record<string, string>;
  }>;
  recordLocalMoves(
    mappings: Array<{ oldPath: string; path: string }>,
  ): Promise<void>;
  replacePendingMoves(pendingMoves: Record<string, string>): Promise<void>;
}

interface EntryMoveJournal {
  version: 1;
  operation_id: string;
  stage: EntryMoveJournalStage;
  source: string;
  destination: string;
  fingerprint: string;
  content_revision: string;
  drive_tracked: boolean;
  pending_moves_before: Record<string, string>;
  link_updates?: Array<{ path: string; before: string; after: string; modifiedAt: number }>;
  source_content?: string;
}

function sha256(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return `sha256:${hash.digest("hex")}`;
}

function noteRevision(rootPath: string, note: NoteDocument): string {
  const digest = createHash("sha256")
    .update(rootPath)
    .update("\0")
    .update(note.path)
    .update("\0")
    .update(String(note.modifiedAt))
    .update("\0")
    .update(String(note.size))
    .update("\0")
    .update(note.content)
    .digest("hex");
  return `sha256:${digest}`;
}

function contentRevision(note: NoteDocument): string {
  return sha256([String(note.modifiedAt), String(note.size), note.content]);
}

function normalizeMarkdownPath(raw: string, label: string): string {
  const validation = validateRelativePath(raw.trim().replaceAll("\\", "/"));
  if (
    !validation.valid ||
    !validation.normalized ||
    !validation.normalized.toLocaleLowerCase().endsWith(".md")
  ) {
    throw new Error(`${label}はVault内のMarkdownノートを指定してください。`);
  }
  return validation.normalized;
}

function recordsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(right).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function pendingMovesAfter(journal: EntryMoveJournal): Record<string, string> {
  const next = { ...journal.pending_moves_before };
  if (!journal.drive_tracked) return next;
  const originalPath =
    Object.entries(next).find(([, target]) => target === journal.source)?.[0] ??
    journal.source;
  delete next[originalPath];
  next[originalPath] = journal.destination;
  return next;
}

function isLinkUpdateProtected(path: string): boolean {
  return isAiImmutablePath(path) || path.startsWith('01_受信箱/');
}

export class EntryMoveCoordinator {
  private recoveryStatus: EntryMoveRecoveryStatus = { status: "clean" };

  constructor(
    private readonly dependencies: {
      vault: VaultService;
      drive: EntryMoveDrive;
      afterJournalStage?: (stage: EntryMoveJournalStage) => Promise<void>;
    },
  ) {}

  getRecoveryStatus(): EntryMoveRecoveryStatus {
    return this.recoveryStatus;
  }

  async recover(): Promise<EntryMoveRecoveryStatus> {
    const rootPath = this.dependencies.vault.getRootPath();
    if (!rootPath) return this.setRecoveryStatus({ status: "clean" });
    const journalPath = join(rootPath, ".tsuzune", "pending-entry-move.json");
    let journal: EntryMoveJournal;
    try {
      journal = JSON.parse(
        await readFile(journalPath, "utf8"),
      ) as EntryMoveJournal;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return this.setRecoveryStatus({ status: "clean" });
      }
      return this.recoveryRequired("", "");
    }

    try {
      const snapshot = await this.dependencies.vault.scan();
      const source = snapshot.notes.find(
        (note) =>
          note.path.toLocaleLowerCase() === journal.source.toLocaleLowerCase(),
      );
      const destination = snapshot.notes.find(
        (note) =>
          note.path.toLocaleLowerCase() ===
          journal.destination.toLocaleLowerCase(),
      );
      const currentLedger = (
        await this.dependencies.drive.inspectLocalMoves([
          { oldPath: journal.source, path: journal.destination },
        ])
      ).pendingMoves;
      const ledgerBefore = recordsEqual(
        currentLedger,
        journal.pending_moves_before,
      );
      const ledgerAfter = recordsEqual(
        currentLedger,
        pendingMovesAfter(journal),
      );

      if (source && !destination && ledgerBefore) {
        if (journal.source_content !== undefined
          ? source.content !== journal.source_content
          : contentRevision(source) !== journal.content_revision) {
          return this.recoveryRequired(journal.source, journal.destination);
        }
        await this.restoreLinks(journal, false);
        await rm(journalPath, { force: true });
        return this.setRecoveryStatus({
          status: "recovered",
          action: "discarded",
        });
      }

      if (
        !source &&
        destination &&
        (journal.source_content !== undefined
          ? destination.content === journal.source_content || destination.content ===
            journal.link_updates?.find(update => update.path === journal.source)?.after
          : contentRevision(destination) === journal.content_revision)
      ) {
        const links = await this.inspectLinks(journal, true);
        if (journal.stage === "ledger" && ledgerAfter) {
          if (links.some(({ update, note }) => note.content !== update.after)) {
            return this.recoveryRequired(journal.source, journal.destination);
          }
          await rm(journalPath, { force: true });
          return this.setRecoveryStatus({
            status: "recovered",
            action: "committed",
          });
        }
        if (ledgerBefore || ledgerAfter) {
          await this.restoreLinks(journal, true);
          if (!ledgerBefore) {
            await this.dependencies.drive.replacePendingMoves(
              journal.pending_moves_before,
            );
          }
          await this.dependencies.vault.moveNote({
            path: journal.destination,
            destinationDirectory: dirnameRelative(journal.source),
            destinationPath: journal.source,
          });
          await rm(journalPath, { force: true });
          return this.setRecoveryStatus({
            status: "recovered",
            action: "rolled-back",
          });
        }
      }
    } catch {
      return this.recoveryRequired(journal.source, journal.destination);
    }
    return this.recoveryRequired(journal.source, journal.destination);
  }

  async preflight(
    rawSource: string,
    rawDestination: string,
    actor: EntryMoveActor,
  ): Promise<EntryMovePlan> {
    return (await this.inspect(rawSource, rawDestination, actor)).plan;
  }

  private async inspect(rawSource: string, rawDestination: string, actor: EntryMoveActor) {
    const source = normalizeMarkdownPath(rawSource, "移動元");
    const destination = normalizeMarkdownPath(rawDestination, "移動先");
    const rootPath = this.dependencies.vault.getRootPath();
    if (rootPath) {
      try {
        await access(join(rootPath, ".tsuzune", "pending-entry-move.json"));
        throw new Error("RECOVERY_REQUIRED: 未完了の移動があります。");
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("RECOVERY_REQUIRED")
        ) {
          throw error;
        }
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new Error("RECOVERY_REQUIRED: 移動journalを確認できません。");
        }
      }
    }
    if (source.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
      throw new Error("移動元と移動先は別のパスを指定してください。");
    }

    const snapshot = await this.dependencies.vault.scan();
    const sourceNote = snapshot.notes.find(
      (note) => note.path.toLocaleLowerCase() === source.toLocaleLowerCase(),
    );
    if (!sourceNote) throw new Error(`移動元が見つかりません: ${source}`);
    if (
      snapshot.notes.some(
        (note) =>
          note.path.toLocaleLowerCase() === destination.toLocaleLowerCase(),
      )
    ) {
      throw new Error(`移動先に同名のノートがあります: ${destination}`);
    }
    const destinationParent = dirnameRelative(destination);
    if (
      !snapshot.directories.some(
        (directory) =>
          directory.toLocaleLowerCase() ===
          destinationParent.toLocaleLowerCase(),
      )
    ) {
      throw new Error(`移動先フォルダが見つかりません: ${destinationParent}`);
    }

    const protectedSource =
      actor === "ai"
        ? isAiMoveProtected(sourceNote.path, destination)
        : isAuditHistoryPath(sourceNote.path);
    const protectedDestination =
      actor === "ai" ? protectedSource : isAuditHistoryPath(destination);
    if (protectedSource || protectedDestination) {
      throw new Error("保護領域のノートはこの操作主体から移動できません。");
    }

    const aliases = compilePathAliases(snapshot.pathAliases ?? {});
    const linkImpact = findLinkImpact(
      snapshot.notes,
      new Map([[sourceNote.path, destination]]),
      aliases,
    );
    const mappings = [{ oldPath: sourceNote.path, path: destination }];
    const drive = await this.dependencies.drive.inspectLocalMoves(mappings);
    const sourceRevision = noteRevision(snapshot.rootPath, sourceNote);
    const sourceContentRevision = contentRevision(sourceNote);
    const linkUpdates: NonNullable<EntryMoveJournal['link_updates']> = [];
    if (actor === "human") {
      const index = buildWikiLinkIndex(snapshot.notes, aliases);
      for (const note of snapshot.notes) {
        if (isLinkUpdateProtected(note.path) || (note.path === sourceNote.path && isLinkUpdateProtected(destination))) continue;
        const after = rewriteMovedLinks(note, index, sourceNote.path, destination);
        if (after === note.content) continue;
        const bytes = await readFile(await this.dependencies.vault.resolveFileForOpen(note.path));
        if (bytes.toString('utf8') !== note.content) throw new Error('preflight中に参照元が変わりました。もう一度操作してください。');
        // Invalid UTF-8 cannot be losslessly written by the text save path.
        if (!bytes.equals(Buffer.from(note.content, 'utf8'))) continue;
        linkUpdates.push({ path: note.path, before: note.content, after, modifiedAt: note.modifiedAt });
      }
    }
    const manifest = {
      source: sourceNote.path,
      destination,
      source_revision: sourceRevision,
      content_revision: sourceContentRevision,
      destination_parent: destinationParent,
      actor,
      protection_policy: "fixed-source-history-v1",
      collision_policy: "fail",
      ...(actor === "human" ? { link_updates: linkUpdates } : {}),
    };
    const fingerprint = sha256([JSON.stringify(manifest)]);

    const plan: EntryMovePlan = {
      source_type: "markdown",
      source: sourceNote.path,
      destination,
      fingerprint,
      source_revision: sourceRevision,
      content_revision: sourceContentRevision,
      counts: { markdown: 1, directories: 0, attachments: 0 },
      mappings: [{ old_path: sourceNote.path, new_path: destination }],
      mapping_truncated: false,
      collision: false,
      protected_source: false,
      protected_destination: false,
      link_impact: {
        affected_count: linkImpact.affectedCount,
        source_paths: linkImpact.sourcePaths.slice(0, 3),
      },
      drive: {
        tracked_moves: drive.tracked,
        untracked_uploads: drive.untracked,
      },
    };
    return { plan, linkUpdates };
  }

  async apply(input: EntryMoveApplyInput): Promise<EntryMoveResult> {
    const { plan, linkUpdates } = await this.inspect(
      input.source,
      input.destination,
      input.actor,
    );
    if (plan.fingerprint !== input.expected_fingerprint) {
      throw new Error(
        "preflight後に状態が変わりました。もう一度preflightしてください。",
      );
    }
    const rootPath = this.dependencies.vault.getRootPath();
    if (!rootPath) throw new Error("Vaultを開いてください。");
    const journalPath = join(rootPath, ".tsuzune", "pending-entry-move.json");
    try {
      await access(journalPath);
      throw new Error("RECOVERY_REQUIRED: 未完了の移動があります。");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("RECOVERY_REQUIRED")
      ) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("RECOVERY_REQUIRED: 移動journalを確認できません。");
      }
    }

    const sourceBefore = await this.dependencies.vault.readNote(plan.source);
    const expectedContentRevision = contentRevision(sourceBefore);
    if (
      noteRevision(rootPath, sourceBefore) !== plan.source_revision ||
      expectedContentRevision !== plan.content_revision
    ) {
      throw new Error(
        "preflight後に移動元が変わりました。もう一度preflightしてください。",
      );
    }
    const mapping = [{ oldPath: plan.source, path: plan.destination }];
    const driveBefore =
      await this.dependencies.drive.inspectLocalMoves(mapping);
    const journal: EntryMoveJournal = {
      version: 1,
      operation_id: randomUUID(),
      stage: "prepared",
      source: plan.source,
      destination: plan.destination,
      fingerprint: plan.fingerprint,
      content_revision: expectedContentRevision,
      drive_tracked: driveBefore.tracked > 0,
      pending_moves_before: driveBefore.pendingMoves,
      ...(linkUpdates.length ? { link_updates: linkUpdates, source_content: sourceBefore.content } : {}),
    };
    await this.writeJournal(journalPath, journal);
    await this.dependencies.afterJournalStage?.("prepared");

    let filesystemMoved = false;
    let ledgerWriteAttempted = false;
    try {
      await this.dependencies.vault.moveNote({
        path: plan.source,
        destinationDirectory: dirnameRelative(plan.destination),
        destinationPath: plan.destination,
      });
      filesystemMoved = true;
      journal.stage = "filesystem";
      await this.writeJournal(journalPath, journal);
      await this.dependencies.afterJournalStage?.("filesystem");

      const movedNote = await this.dependencies.vault.readNote(
        plan.destination,
      );
      if (contentRevision(movedNote) !== expectedContentRevision) {
        throw new Error("移動直後の内容がpreflight manifestと一致しません。");
      }

      if (linkUpdates.length) {
        journal.stage = "links";
        await this.writeJournal(journalPath, journal);
      }
      for (const update of linkUpdates) {
        await this.dependencies.vault.saveNote({
          path: update.path === plan.source ? plan.destination : update.path,
          content: update.after,
          expectedContent: update.before,
          expectedModifiedAt: update.modifiedAt,
        });
        await this.dependencies.afterJournalStage?.("links");
      }

      ledgerWriteAttempted = true;
      await this.dependencies.drive.recordLocalMoves(mapping);
      journal.stage = "ledger";
      await this.writeJournal(journalPath, journal);
      await this.dependencies.afterJournalStage?.("ledger");

      await rm(journalPath, { force: true });
      return {
        old_path: plan.source,
        new_path: plan.destination,
        fingerprint: plan.fingerprint,
      };
    } catch (error) {
      try {
        await this.restoreLinks(journal, filesystemMoved);
        if (ledgerWriteAttempted) {
          await this.dependencies.drive.replacePendingMoves(
            journal.pending_moves_before,
          );
        }
        if (filesystemMoved) {
          await this.dependencies.vault.moveNote({
            path: plan.destination,
            destinationDirectory: dirnameRelative(plan.source),
            destinationPath: plan.source,
          });
        }
        await rm(journalPath, { force: true });
      } catch {
        throw new Error(
          `RECOVERY_REQUIRED: 移動を元へ戻せませんでした: ${plan.destination}`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  private async inspectLinks(journal: EntryMoveJournal, moved: boolean) {
    return Promise.all((journal.link_updates ?? []).map(async (update) => {
      const path = moved && update.path === journal.source ? journal.destination : update.path;
      if (isLinkUpdateProtected(path)) throw new Error('保護領域の参照元は復旧時も書き換えません。');
      const note = await this.dependencies.vault.readNote(path);
      if (note.content !== update.before && note.content !== update.after) {
        throw new Error(`参照元が別のアプリで変更されています: ${path}`);
      }
      return { update, note };
    }));
  }

  private async restoreLinks(journal: EntryMoveJournal, moved: boolean): Promise<void> {
    for (const { update, note } of await this.inspectLinks(journal, moved)) {
      if (note.content === update.before) continue;
      await this.dependencies.vault.saveNote({ path: note.path, content: update.before,
        expectedContent: update.after, expectedModifiedAt: note.modifiedAt });
    }
  }

  async trash(input: EntryTrashApplyInput): Promise<EntryTrashResult> {
    const source = normalizeMarkdownPath(input.source, "削除元");
    if (input.actor === "ai" && !source.startsWith("01_受信箱/")) {
      throw new Error("AIは01_受信箱のMarkdown原典だけをごみ箱へ移動できます。");
    }
    if (isAuditHistoryPath(source)) {
      throw new Error("監査履歴はごみ箱へ移動できません。");
    }

    const inspect = async () => {
      const snapshot = await this.dependencies.vault.scan();
      const sourceNote = snapshot.notes.find(
        (note) => note.path.toLocaleLowerCase() === source.toLocaleLowerCase(),
      );
      if (!sourceNote) throw new Error(`削除元が見つかりません: ${source}`);
      const sourceRevision = noteRevision(snapshot.rootPath, sourceNote);
      if (sourceRevision !== input.expected_revision) {
        throw new Error("削除元のrevisionが変わりました。もう一度fetchしてください。");
      }

      const aliases = compilePathAliases(snapshot.pathAliases ?? {});
      const backlinks = getBacklinks(sourceNote.path, snapshot.notes, aliases);
      if (backlinks.length > 0) {
        throw new Error(
          `リンク元が${backlinks.length}件残っています。先に出典表示を更新してください。`,
        );
      }
      return { sourceNote, sourceRevision };
    };

    const ready = await inspect();
    const result = await this.dependencies.vault.trashEntry(
      ready.sourceNote.path,
      async () => {
        await inspect();
      },
    );
    if (!result.path) {
      throw new Error("ごみ箱の移動先を確認できませんでした。");
    }
    return {
      old_path: ready.sourceNote.path,
      new_path: result.path,
      source_revision: ready.sourceRevision,
    };
  }

  private recoveryRequired(
    source: string,
    destination: string,
  ): { status: "recovery-required"; source: string; destination: string } {
    return this.setRecoveryStatus({
      status: "recovery-required",
      source,
      destination,
    });
  }

  private setRecoveryStatus<T extends EntryMoveRecoveryStatus>(status: T): T {
    this.recoveryStatus = status;
    return status;
  }

  private async writeJournal(
    path: string,
    journal: EntryMoveJournal,
  ): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp-${randomUUID()}`;
    const handle = await open(temporaryPath, "wx");
    try {
      await handle.writeFile(JSON.stringify(journal), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}
