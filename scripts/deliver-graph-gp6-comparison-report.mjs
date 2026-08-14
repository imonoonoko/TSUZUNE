import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  repoRoot,
  "docs",
  "reports",
  "graph-gp6-production-comparison-2026-08-02.artifact.json",
);
const outputPath = resolve(
  repoRoot,
  "docs",
  "reports",
  "graph-gp6-production-comparison-2026-08-02.html",
);

const pluginBase = resolve(
  process.env.USERPROFILE ?? "",
  ".codex",
  "plugins",
  "cache",
  "openai-curated-remote",
  "data-analytics",
);

const pluginRoot = readdirSync(pluginBase, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(pluginBase, entry.name))
  .filter((candidate) =>
    existsSync(
      join(
        candidate,
        "skills",
        "build-report",
        "scripts",
        "deliver_portable_artifact.mjs",
      ),
    ),
  )
  .sort()
  .at(-1);

if (!pluginRoot) {
  throw new Error(`Data Analytics report builder was not found under ${pluginBase}.`);
}

const scriptsRoot = join(pluginRoot, "skills", "build-report", "scripts");
const { deliverPortableArtifact } = await import(
  pathToFileURL(join(scriptsRoot, "deliver_portable_artifact.mjs")).href
);
const { verifyPortableArtifact } = await import(
  pathToFileURL(join(scriptsRoot, "verify_portable_artifact.mjs")).href
);

const overflowFixMarker = "data-tsuzune-portable-topbar-fix";
const overflowFix = `<style ${overflowFixMarker}="true">
  /* 100vw includes the desktop iframe's vertical scrollbar and creates an
     8px horizontal overflow. Keep the full-bleed header inside clientWidth. */
  .analytics-top-bar {
    width: auto !important;
    margin-inline: calc(0px - var(--ds-gutter)) !important;
  }
</style>`;

async function verifyPatched(options) {
  let html = readFileSync(options.htmlPath, "utf8");
  if (!html.includes(overflowFixMarker)) {
    const closingHeadIndex = html.lastIndexOf("</head>");
    if (closingHeadIndex < 0) {
      throw new Error("Portable report HTML has no closing head element.");
    }
    html = `${html.slice(0, closingHeadIndex)}${overflowFix}\n${html.slice(closingHeadIndex)}`;
    writeFileSync(options.htmlPath, html, "utf8");
  }
  return verifyPortableArtifact(options);
}

const result = await deliverPortableArtifact(
  {
    inputPath,
    outputPath,
    screenshotPath: `${outputPath}.verification-failure.png`,
    timeoutMs: 20_000,
  },
  { verify: verifyPatched },
);

console.log(JSON.stringify(result, null, 2));
