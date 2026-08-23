const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { app, safeStorage } = require("electron");
const { extractFile } = require("@electron/asar");

const objectId = process.env.TSUZUNE_DRIVE_TRASH_ID;
const installedAsar = join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "tsuzune",
  "resources",
  "app.asar",
);
const refreshTokenPath = join(
  process.env.APPDATA ?? "",
  "tsuzune",
  "google",
  "refresh-token.json",
);

app.commandLine.appendSwitch("disable-gpu");

async function trashDriveObject() {
  assert.ok(objectId, "TSUZUNE_DRIVE_TRASH_ID is required");
  const stored = JSON.parse(await readFile(refreshTokenPath, "utf8"));
  const decrypted = await safeStorage.decryptStringAsync(
    Buffer.from(stored.ciphertext, "base64"),
  );
  const credential = JSON.parse(decrypted.result);
  const source = extractFile(installedAsar, "out\\main\\index.js").toString(
    "utf8",
  );
  const clientIds = source.match(
    /[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com/g,
  );
  const clientSecrets = source.match(/GOCSPX-[A-Za-z0-9_-]+/g);
  assert.equal(new Set(clientIds).size, 1);
  assert.equal(new Set(clientSecrets).size, 1);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientIds[0],
      client_secret: clientSecrets[0],
      refresh_token: credential.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(tokenResponse.ok, true);
  const token = await tokenResponse.json();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(objectId)}?fields=trashed`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  assert.equal(response.ok, true);
  assert.equal((await response.json()).trashed, true);
}

const timeout = setTimeout(() => {
  console.error("Drive cleanup timed out.");
  app.exit(2);
}, 45_000);

app
  .whenReady()
  .then(trashDriveObject)
  .then(
    () => {
      clearTimeout(timeout);
      app.exit(0);
    },
    (error) => {
      clearTimeout(timeout);
      console.error(error instanceof Error ? error.message : String(error));
      app.exit(1);
    },
  );
