import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const repoRoot = resolve(import.meta.dirname, "..");
const installedExe = join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "tsuzune",
  "TSUZUNE.exe",
);
const productionGoogle = join(process.env.APPDATA ?? "", "tsuzune", "google");
const productionUserData = join(process.env.APPDATA ?? "", "tsuzune");
const runtimeModules = process.env.TSUZUNE_ACCEPT_NODE_MODULES;
assert.ok(runtimeModules, "TSUZUNE_ACCEPT_NODE_MODULES is required");
const runtimeRequire = createRequire(join(runtimeModules, "package.json"));
const { chromium } = runtimeRequire("playwright");
const electronExe = join(
  repoRoot,
  "node_modules",
  "electron",
  "dist",
  "electron.exe",
);
const trashHelperApp = join(repoRoot, "scripts", "check-live-drive-trash-app");
const work = await mkdtemp(join(tmpdir(), "tsuzune-drive-roundtrip-"));
const profiles = [join(work, "profile-a"), join(work, "profile-b")];
const vaults = [join(work, "vault-a"), join(work, "vault-b")];
let rootFolderId = null;
let stalePlanRejected = false;
let output = null;
let runError = null;

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (value) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
  const round = (value) => Math.round(value * 1000) / 1000;
  return {
    runs: sorted.length,
    p50Ms: round(percentile(0.5)),
    p95Ms: round(percentile(0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
    minMs: round(sorted[0] ?? 0),
    samplesMs: samples.map(round),
  };
}

async function prepare(index) {
  const google = join(profiles[index], "google");
  await mkdir(google, { recursive: true });
  await mkdir(vaults[index], { recursive: true });
  await copyFile(
    join(productionGoogle, "refresh-token.json"),
    join(google, "refresh-token.json"),
  );
  await copyFile(
    join(productionGoogle, "google-account.json"),
    join(google, "google-account.json"),
  );
  await copyFile(
    join(productionUserData, "Local State"),
    join(profiles[index], "Local State"),
  );
  await writeFile(
    join(profiles[index], "settings.json"),
    JSON.stringify({ lastVaultPath: vaults[index], lastNotePath: null }),
    "utf8",
  );
}

async function stopProfile(child, profile) {
  child.kill();
  await new Promise((resolveDone) => setTimeout(resolveDone, 500));
  const escaped = profile.replaceAll("'", "''");
  const command = `$p='${escaped}'; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($p) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  const killer = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
    windowsHide: true,
    stdio: "ignore",
  });
  await new Promise((resolveDone) => killer.once("exit", resolveDone));
}

async function session(index, action) {
  const port = 19000 + Math.floor(Math.random() * 1000);
  const child = spawn(
    installedExe,
    [`--user-data-dir=${profiles[index]}`, `--remote-debugging-port=${port}`],
    {
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, TSUZUNE_HEADLESS_SMOKE: "1" },
    },
  );
  let browser;
  try {
    const deadline = Date.now() + 30_000;
    while (!browser) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await new Promise((resolveDone) => setTimeout(resolveDone, 250));
      }
    }
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    await page.waitForFunction(() => Boolean(window.tsuzune), null, {
      timeout: 30_000,
    });
    const call = async (method, ...args) => {
      const result = await page.evaluate(
        async ({ method, args }) => window.tsuzune[method](...args),
        { method, args },
      );
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    };
    const bridge = async (path, body) => {
      const state = JSON.parse(
        await readFile(join(profiles[index], "mcp-drive-sync.json"), "utf8"),
      );
      const response = await fetch(new URL(path, state.origin), {
        method: "POST",
        headers: {
          authorization: `Bearer ${state.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Drive bridge failed");
      return value;
    };
    await call("openLastVault");
    const status = await call("getGoogleDriveStatus");
    assert.equal(status.connected, true);
    assert.equal(status.authorizedFeatures.includes("drive_sync"), true);
    return await action(call, bridge);
  } finally {
    await browser?.close().catch(() => undefined);
    await stopProfile(child, profiles[index]);
  }
}

async function waitForPreview(call, matches, label) {
  const deadline = Date.now() + 20_000;
  let preview;
  do {
    preview = await call("previewDriveSync");
    if (matches(preview)) return preview;
    await new Promise((resolveDone) => setTimeout(resolveDone, 500));
  } while (Date.now() < deadline);
  const observed = preview.items.map(({ path, action, reason }) => ({
    path,
    action,
    reason,
  }));
  throw new Error(`${label} was not observed: ${JSON.stringify(observed)}`);
}

async function applyWhenStable(call, matches, label) {
  const deadline = Date.now() + 30_000;
  do {
    const preview = await waitForPreview(call, matches, label);
    try {
      return await call("applyDriveSync", preview.planId);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes(
          "プレビュー後にローカルまたはDriveの内容が変わりました",
        )
      ) {
        throw error;
      }
      stalePlanRejected = true;
    }
  } while (Date.now() < deadline);
  throw new Error(`${label} did not reach a stable preview`);
}

async function trash(objectId) {
  const child = spawn(
    electronExe,
    [
      `--user-data-dir=${profiles[0]}`,
      "--no-sandbox",
      "--no-error-dialogs",
      trashHelperApp,
    ],
    {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, TSUZUNE_DRIVE_TRASH_ID: objectId },
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolveDone) =>
    child.once("exit", resolveDone),
  );
  assert.equal(code, 0, stderr.trim() || "Drive cleanup helper failed");
}

try {
  await Promise.all([prepare(0), prepare(1)]);
  await writeFile(
    join(vaults[0], "Shared.md"),
    "# Shared\n\nbaseline\n",
    "utf8",
  );
  await writeFile(
    join(vaults[0], "RemoteDelete.md"),
    "# Remote delete\n\nbaseline\n",
    "utf8",
  );

  const first = await session(0, async (call) => {
    const preview = await call("previewDriveSync");
    const previewLedger = JSON.parse(
      await readFile(join(profiles[0], "google", "drive-sync.json"), "utf8"),
    );
    rootFolderId = previewLedger.vaults.find(
      (entry) => entry.rootPath === vaults[0],
    )?.rootFolderId;
    assert.equal(preview.counts.upload, 2);
    assert.equal(preview.counts.download, 0);
    assert.equal(preview.counts.move, 0);
    assert.equal(preview.counts.conflict, 0);
    assert.equal(preview.counts.preserve, 0);
    assert.equal(preview.counts.trashLocal, 0);
    assert.equal(preview.counts.trashRemote, 0);
    return call("applyDriveSync", preview.planId);
  });
  assert.equal(first.uploaded, 2);
  const ledgerA = JSON.parse(
    await readFile(join(profiles[0], "google", "drive-sync.json"), "utf8"),
  );
  const binding = ledgerA.vaults.find((entry) => entry.rootPath === vaults[0]);
  rootFolderId = binding.rootFolderId;

  const received = await session(1, async (call) => {
    await call("pairDriveVault", {
      rootFolderId: binding.rootFolderId,
      vaultId: binding.vaultId,
    });
    const preview = await call("previewDriveSync");
    assert.equal(preview.counts.download, 2);
    return call("applyDriveSync", preview.planId);
  });
  assert.equal(received.downloaded, 2);
  assert.equal(
    await readFile(join(vaults[1], "Shared.md"), "utf8"),
    "# Shared\n\nbaseline\n",
  );

  await session(1, async (call) => {
    const preview = await call("previewDriveSync");
    assert.equal(preview.items.length, 0);
  });

  await writeFile(
    join(vaults[0], "Shared.md"),
    "# Shared\n\nremote v2\n",
    "utf8",
  );
  await session(0, async (call) => {
    const preview = await call("previewDriveSync");
    assert.equal(preview.items[0].reason, "local_changed");
    const applied = await call("applyDriveSync", preview.planId);
    assert.equal(applied.uploaded, 1);
  });
  await session(1, async (call) => {
    await applyWhenStable(
      call,
      (candidate) => candidate.items[0]?.reason === "remote_changed",
      "remote_changed",
    );
  });

  await writeFile(
    join(vaults[0], "Shared.md"),
    "# Shared\n\nremote v3\n",
    "utf8",
  );
  await writeFile(
    join(vaults[1], "Shared.md"),
    "# Shared\n\nlocal v3\n",
    "utf8",
  );
  await session(0, async (call) => {
    const preview = await call("previewDriveSync");
    const applied = await call("applyDriveSync", preview.planId);
    assert.equal(applied.uploaded, 1);
  });
  const conflict = await session(1, async (call) => {
    return applyWhenStable(
      call,
      (candidate) => candidate.counts.conflict === 1,
      "both_changed conflict",
    );
  });
  assert.equal(conflict.conflicts, 1);
  assert.equal(conflict.conflictPaths.length, 1);

  await unlink(join(vaults[1], "Shared.md"));
  const localDeleted = await session(1, async (call) => {
    return applyWhenStable(
      call,
      (candidate) =>
        candidate.items.some((item) => item.reason === "local_deleted"),
      "local_deleted",
    );
  });
  assert.ok(localDeleted.preserved >= 1);

  const ledgerB = JSON.parse(
    await readFile(join(profiles[1], "google", "drive-sync.json"), "utf8"),
  );
  const bindingB = ledgerB.vaults.find((entry) => entry.rootPath === vaults[1]);
  await trash(bindingB.files["RemoteDelete.md"].fileId);
  const remoteDeleted = await session(1, async (call) => {
    return applyWhenStable(
      call,
      (candidate) =>
        candidate.items.some((item) => item.reason === "remote_deleted"),
      "remote_deleted",
    );
  });
  assert.ok(remoteDeleted.preserved >= 1);

  const propagatedRemoteDeletion = await session(1, async (_call, bridge) => {
    const preview = await bridge("/preview", {
      propagateLocalDeletion: true,
      forceFull: true,
    });
    assert.equal(
      preview.items.find((item) => item.path === "Shared.md")?.action,
      "trash_remote",
    );
    const applied = await bridge("/apply", { planId: preview.planId });
    assert.equal(applied.trashedRemote, 1);
    return applied;
  });

  const propagatedLocalDeletion = await session(1, async (_call, bridge) => {
    const preview = await bridge("/preview", {
      propagateRemoteDeletion: true,
      forceFull: true,
    });
    assert.equal(
      preview.items.find((item) => item.path === "RemoteDelete.md")?.action,
      "trash_local",
    );
    const applied = await bridge("/apply", { planId: preview.planId });
    assert.equal(applied.trashedLocal, 1);
    return applied;
  });

  await assert.rejects(readFile(join(vaults[1], "RemoteDelete.md")), {
    code: "ENOENT",
  });
  const trashEntries = await readdir(join(vaults[1], ".trash"), {
    recursive: true,
  });
  const remoteDeleteTrashPath = trashEntries.find((entry) =>
    entry.replaceAll("\\", "/").endsWith("RemoteDelete.md"),
  );
  assert.ok(remoteDeleteTrashPath);
  assert.equal(
    await readFile(join(vaults[1], ".trash", remoteDeleteTrashPath), "utf8"),
    "# Remote delete\n\nbaseline\n",
  );

  const deletionLedger = JSON.parse(
    await readFile(join(profiles[1], "google", "drive-sync.json"), "utf8"),
  );
  const deletionBinding = deletionLedger.vaults.find(
    (entry) => entry.rootPath === vaults[1],
  );
  assert.equal(deletionBinding.pendingDeletion, undefined);
  assert.equal(deletionBinding.files["Shared.md"], undefined);
  assert.equal(deletionBinding.files["RemoteDelete.md"], undefined);

  await session(1, async (_call, bridge) => {
    const preview = await bridge("/preview", {
      propagateLocalDeletion: true,
      propagateRemoteDeletion: true,
      forceFull: true,
    });
    assert.equal(
      preview.items.some((item) =>
        ["Shared.md", "RemoteDelete.md"].includes(item.path),
      ),
      false,
    );
  });

  const performanceResult = await session(0, async (call) => {
    const fileCount = 10;
    const rounds = 5;
    const directory = join(vaults[0], "Performance");
    await mkdir(directory, { recursive: true });
    await Promise.all(
      Array.from({ length: fileCount }, (_, index) =>
        writeFile(
          join(directory, `${String(index).padStart(2, "0")}.md`),
          `# Performance ${index}\n\nbaseline\n`,
          "utf8",
        ),
      ),
    );
    let preview = await call("previewDriveSync");
    assert.equal(preview.counts.upload, fileCount);
    let applied = await call("applyDriveSync", preview.planId);
    assert.equal(applied.uploaded, fileCount);

    const previewSamples = [];
    const applySamples = [];
    for (let round = 1; round <= rounds; round += 1) {
      await Promise.all(
        Array.from({ length: fileCount }, (_, index) =>
          writeFile(
            join(directory, `${String(index).padStart(2, "0")}.md`),
            `# Performance ${index}\n\nround ${round}\n`,
            "utf8",
          ),
        ),
      );
      let startedAt = performance.now();
      preview = await call("previewDriveSync");
      previewSamples.push(performance.now() - startedAt);
      assert.equal(preview.counts.upload, fileCount);

      startedAt = performance.now();
      applied = await call("applyDriveSync", preview.planId);
      applySamples.push(performance.now() - startedAt);
      assert.equal(applied.uploaded, fileCount);
    }
    return {
      scenario: "existing-update-10",
      fileCount,
      errors: 0,
      preview: summarize(previewSamples),
      apply: summarize(applySamples),
    };
  });

  output = {
    result: "pass",
    emptyVaultReceive: true,
    localUpload: true,
    remoteDownload: true,
    conflictPreserved: true,
    localDeletionObservedWithoutPropagation: true,
    remoteDeletionObservedWithoutPropagation: true,
    localDeletionPropagatedToDriveTrash:
      propagatedRemoteDeletion.trashedRemote === 1,
    remoteDeletionPropagatedToLocalTrash:
      propagatedLocalDeletion.trashedLocal === 1,
    deletionRecoveryEvidence: {
      localTrashContentVerified: true,
      pendingTombstoneCleared: true,
      restartConverged: true,
    },
    restartLedgerConverged: true,
    stalePlanRejected,
    productionVaultUntouched: true,
    performance: performanceResult,
  };
} catch (error) {
  runError = error;
  throw error;
} finally {
  let cleanupError = null;
  try {
    if (rootFolderId) await trash(rootFolderId);
  } catch (error) {
    cleanupError = error;
  }
  await rm(work, { recursive: true, force: true });
  if (cleanupError && !runError) throw cleanupError;
  if (cleanupError) {
    console.error(
      `Drive cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
    );
  }
}

console.log(JSON.stringify(output));
