import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const directory = dirname(fileURLToPath(import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "tsuzune-history-preview-"));
const bundle = join(temporary, "preview.mjs");
try {
  await build({
    entryPoints: [resolve(directory, "preview-history-compaction.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "silent",
  });
  const module = await import(pathToFileURL(bundle).href);
  await module.runCli(process.argv);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
