// scripts/generate-life-weather-prototype.ts
import { createHash } from "node:crypto";
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";

// src/shared/attachments.ts
var SUPPORTED_ATTACHMENT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".svg",
  ".webp",
  ".avif",
  ".pdf",
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".mp4",
  ".webm",
  ".mov",
  ".mkv"
]);
function isSupportedAttachmentPath(path) {
  const fileName = path.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return false;
  }
  return SUPPORTED_ATTACHMENT_EXTENSIONS.has(
    fileName.slice(dotIndex).toLocaleLowerCase()
  );
}

// src/core/paths.ts
var WINDOWS_RESERVED_NAMES = /* @__PURE__ */ new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9"
]);
function validateEntryName(name) {
  if (name.length === 0) {
    return { valid: false, reason: "\u540D\u524D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002" };
  }
  if (name !== name.trim()) {
    return { valid: false, reason: "\u540D\u524D\u306E\u5148\u982D\u3084\u672B\u5C3E\u306B\u7A7A\u767D\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002" };
  }
  if (name.startsWith(".")) {
    return { valid: false, reason: "\u30C9\u30C3\u30C8\u3067\u59CB\u307E\u308B\u540D\u524D\u306FTSUZUNE\u306E\u7BA1\u7406\u5BFE\u8C61\u306B\u3067\u304D\u307E\u305B\u3093\u3002" };
  }
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name)) {
    return { valid: false, reason: "Windows\u3067\u4F7F\u3048\u306A\u3044\u6587\u5B57\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002" };
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    return { valid: false, reason: "\u540D\u524D\u306E\u672B\u5C3E\u306B\u30D4\u30EA\u30AA\u30C9\u3084\u7A7A\u767D\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002" };
  }
  const baseName = name.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return { valid: false, reason: "Windows\u306E\u4E88\u7D04\u540D\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002" };
  }
  return { valid: true, normalized: name };
}
function validateRelativePath(value) {
  if (!value) {
    return { valid: true, normalized: "" };
  }
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\")) {
    return { valid: false, reason: "\u7D76\u5BFE\u30D1\u30B9\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002" };
  }
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "" || part === "." || part === "..") {
      return { valid: false, reason: "\u7A7A\u306E\u968E\u5C64\u3001.\u3001.. \u306F\u4F7F\u3048\u307E\u305B\u3093\u3002" };
    }
    const entryValidation = validateEntryName(part);
    if (!entryValidation.valid) {
      return entryValidation;
    }
  }
  return { valid: true, normalized: parts.join("/") };
}
function joinRelative(...parts) {
  return parts.filter(Boolean).map((part) => part.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}
function dirnameRelative(value) {
  const normalized = value.replaceAll("\\", "/");
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}
function basenameRelative(value) {
  const normalized = value.replaceAll("\\", "/");
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? normalized : normalized.slice(separator + 1);
}
function withoutMarkdownExtension(value) {
  return value.toLowerCase().endsWith(".md") ? value.slice(0, -3) : value;
}
function withMarkdownExtension(value) {
  return value.toLowerCase().endsWith(".md") ? value : `${value}.md`;
}
function isPathInsideOrEqual(path, parent) {
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedParent = parent.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`);
}

// src/core/links.ts
function getFence(line) {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  if (!match) {
    return null;
  }
  return {
    character: match[1][0],
    length: match[1].length
  };
}
function isClosingFence(line, fence) {
  const pattern = fence.character === "`" ? new RegExp(`^\\s*\`{${fence.length},}\\s*$`) : new RegExp(`^\\s*~{${fence.length},}\\s*$`);
  return pattern.test(line);
}
function readWikiLink(raw) {
  const body = raw.slice(2, -2);
  const separator = body.indexOf("|");
  const target = (separator < 0 ? body : body.slice(0, separator)).trim();
  const alias = separator < 0 ? null : body.slice(separator + 1).trim();
  if (!target) {
    return null;
  }
  return {
    raw,
    target,
    alias: alias || null
  };
}
function processInlineLine(line, onLink) {
  let output = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] === "`") {
      let tickCount = 1;
      while (line[index + tickCount] === "`") {
        tickCount += 1;
      }
      const marker = "`".repeat(tickCount);
      const closing = line.indexOf(marker, index + tickCount);
      if (closing < 0) {
        output += line.slice(index);
        break;
      }
      output += line.slice(index, closing + tickCount);
      index = closing + tickCount;
      continue;
    }
    if (line.startsWith("[[", index)) {
      const closing = line.indexOf("]]", index + 2);
      if (closing >= 0) {
        const raw = line.slice(index, closing + 2);
        const occurrence = readWikiLink(raw);
        output += occurrence ? onLink(occurrence, index > 0 && line[index - 1] === "!") : raw;
        index = closing + 2;
        continue;
      }
    }
    output += line[index];
    index += 1;
  }
  return output;
}
function walkMarkdown(markdown, onLink) {
  const lines = markdown.split("\n");
  let activeFence = null;
  return lines.map((line) => {
    if (activeFence) {
      if (isClosingFence(line, activeFence)) {
        activeFence = null;
      }
      return line;
    }
    const openingFence = getFence(line);
    if (openingFence) {
      activeFence = openingFence;
      return line;
    }
    return processInlineLine(line, onLink);
  }).join("\n");
}
function extractWikiLinks(markdown) {
  const links = [];
  walkMarkdown(markdown, (occurrence) => {
    links.push(occurrence);
    return occurrence.raw;
  });
  return links;
}
function addCandidate(candidatesByName, name, path) {
  const candidates = candidatesByName.get(name) ?? [];
  if (!candidates.some((candidate) => candidate.toLocaleLowerCase() === path.toLocaleLowerCase())) {
    candidates.push(path);
    candidatesByName.set(name, candidates);
  }
}
function buildWikiLinkIndex(notes, pathAliases) {
  const exactPaths = /* @__PURE__ */ new Map();
  const basenameCandidates = /* @__PURE__ */ new Map();
  for (const note of notes) {
    const pathKey2 = note.path.toLocaleLowerCase();
    if (!exactPaths.has(pathKey2)) {
      exactPaths.set(pathKey2, note.path);
    }
    addCandidate(
      basenameCandidates,
      withoutMarkdownExtension(basenameRelative(note.path)).toLocaleLowerCase(),
      note.path
    );
  }
  const aliasExactPaths = /* @__PURE__ */ new Map();
  const aliasBasenameCandidates = /* @__PURE__ */ new Map();
  if (pathAliases) {
    for (const [oldPathKey, canonicalPath] of pathAliases.flattened) {
      if (exactPaths.has(oldPathKey)) {
        continue;
      }
      const liveCanonicalPath = exactPaths.get(canonicalPath.toLocaleLowerCase());
      if (!liveCanonicalPath) {
        continue;
      }
      aliasExactPaths.set(oldPathKey, liveCanonicalPath);
      addCandidate(
        aliasBasenameCandidates,
        withoutMarkdownExtension(basenameRelative(oldPathKey)).toLocaleLowerCase(),
        liveCanonicalPath
      );
    }
  }
  return {
    exactPaths,
    basenameCandidates,
    aliasExactPaths,
    aliasBasenameCandidates
  };
}
function resolveIndexedWikiLink(target, index) {
  const baseTarget = target.trim().split("#", 1)[0];
  const normalizedTarget = withoutMarkdownExtension(baseTarget).replaceAll("\\", "/");
  const validation = validateRelativePath(normalizedTarget);
  if (!validation.valid || !validation.normalized) {
    return {
      status: "invalid",
      candidates: [],
      reason: validation.reason ?? "\u7121\u52B9\u306A\u30EA\u30F3\u30AF\u3067\u3059\u3002"
    };
  }
  const normalized = validation.normalized;
  const intendedPath = withMarkdownExtension(normalized);
  const lowerTarget = intendedPath.toLocaleLowerCase();
  if (normalized.includes("/")) {
    const resolvedPath = index.exactPaths.get(lowerTarget) ?? index.aliasExactPaths.get(lowerTarget);
    return resolvedPath ? { status: "resolved", path: resolvedPath, candidates: [resolvedPath] } : { status: "missing", path: intendedPath, candidates: [] };
  }
  const basenameKey = normalized.toLocaleLowerCase();
  const candidates = index.basenameCandidates.get(basenameKey);
  if (candidates) {
    return candidates.length === 1 ? { status: "resolved", path: candidates[0], candidates: [...candidates] } : { status: "ambiguous", candidates: [...candidates] };
  }
  const aliasCandidates = index.aliasBasenameCandidates.get(basenameKey);
  if (aliasCandidates) {
    return aliasCandidates.length === 1 ? {
      status: "resolved",
      path: aliasCandidates[0],
      candidates: [...aliasCandidates]
    } : { status: "ambiguous", candidates: [...aliasCandidates] };
  }
  return { status: "missing", path: intendedPath, candidates: [] };
}

// src/core/tags.ts
var TAG_NAME_PATTERN = /^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u;
var BODY_TAG_PATTERN = /(^|[^\p{L}\p{N}_/-])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu;
function normalizeTag(value) {
  let tag = value.trim();
  if (tag.length >= 2 && (tag.startsWith('"') && tag.endsWith('"') || tag.startsWith("'") && tag.endsWith("'"))) {
    tag = tag.slice(1, -1).trim();
  }
  if (tag.startsWith("#")) {
    tag = tag.slice(1);
  }
  return TAG_NAME_PATTERN.test(tag) ? `#${tag}` : null;
}
function extractFrontmatterTags(lines) {
  const tags = [];
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^\s*tags\s*:\s*(.*)$/i);
    if (!field) {
      continue;
    }
    const value = field[1].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      for (const item of value.slice(1, -1).split(",")) {
        const tag = normalizeTag(item);
        if (tag) {
          tags.push(tag);
        }
      }
      continue;
    }
    if (value !== "") {
      const tag = normalizeTag(value);
      if (tag) {
        tags.push(tag);
      }
      continue;
    }
    for (let itemIndex = index + 1; itemIndex < lines.length; itemIndex += 1) {
      if (lines[itemIndex].trim() === "") {
        continue;
      }
      const listItem = lines[itemIndex].match(/^\s+-\s*(.+?)\s*$/);
      if (!listItem) {
        break;
      }
      const tag = normalizeTag(listItem[1]);
      if (tag) {
        tags.push(tag);
      }
      index = itemIndex;
    }
  }
  return tags;
}
function stripInlineCode(line) {
  let result = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      result += line[index];
      index += 1;
      continue;
    }
    let delimiterLength = 1;
    while (line[index + delimiterLength] === "`") {
      delimiterLength += 1;
    }
    const delimiter = "`".repeat(delimiterLength);
    const closingIndex = line.indexOf(delimiter, index + delimiterLength);
    if (closingIndex === -1) {
      result += delimiter;
      index += delimiterLength;
      continue;
    }
    result += " ".repeat(closingIndex + delimiterLength - index);
    index = closingIndex + delimiterLength;
  }
  return result;
}
function extractBodyTags(lines) {
  const tags = [];
  let fenceMarker = null;
  let fenceLength = 0;
  for (const originalLine of lines) {
    const fence = originalLine.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!fenceMarker) {
        fenceMarker = marker;
        fenceLength = fence[1].length;
      } else if (marker === fenceMarker && fence[1].length >= fenceLength) {
        fenceMarker = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceMarker || /^\s{0,3}#{1,6}(?:\s|$)/.test(originalLine)) {
      continue;
    }
    const line = stripInlineCode(originalLine).replace(
      /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi,
      ""
    );
    for (const match of line.matchAll(BODY_TAG_PATTERN)) {
      tags.push(`#${match[2]}`);
    }
  }
  return tags;
}
function extractMarkdownTags(markdown) {
  const lines = markdown.split(/\r?\n/);
  let frontmatterTags = [];
  let bodyLines = lines;
  if (lines[0]?.trim() === "---") {
    const closingIndex = lines.findIndex(
      (line, index) => index > 0 && line.trim() === "---"
    );
    if (closingIndex > 0) {
      frontmatterTags = extractFrontmatterTags(lines.slice(1, closingIndex));
      bodyLines = lines.slice(closingIndex + 1);
    }
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const tag of [...frontmatterTags, ...extractBodyTags(bodyLines)]) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

// src/core/graph.ts
function comparePath(left, right) {
  const localized = left.localeCompare(right, "ja");
  if (localized !== 0) {
    return localized;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}
function buildAttachmentLinkIndex(attachments) {
  const exactPaths = /* @__PURE__ */ new Map();
  const uniqueBasenames = /* @__PURE__ */ new Map();
  for (const attachment of attachments) {
    exactPaths.set(attachment.path.toLocaleLowerCase(), attachment.path);
    const basename2 = basenameRelative(attachment.path).toLocaleLowerCase();
    uniqueBasenames.set(
      basename2,
      uniqueBasenames.has(basename2) ? null : attachment.path
    );
  }
  return { exactPaths, uniqueBasenames };
}
function resolveIndexedAttachmentLink(target, index) {
  const noteTarget = target.trim().split("#", 1)[0].replaceAll("\\", "/");
  const validation = validateRelativePath(noteTarget);
  if (!validation.valid || !validation.normalized) {
    return { status: "invalid" };
  }
  const normalized = validation.normalized;
  if (normalized.includes("/")) {
    const resolvedPath = index.exactPaths.get(normalized.toLocaleLowerCase());
    return resolvedPath ? { status: "resolved", path: resolvedPath } : { status: "missing", path: normalized };
  }
  const candidate = index.uniqueBasenames.get(normalized.toLocaleLowerCase());
  if (candidate === null) {
    return { status: "ambiguous" };
  }
  return candidate ? { status: "resolved", path: candidate } : { status: "missing", path: normalized };
}
function buildWikiGraph(notes, options = {}) {
  const nodes = notes.map((note) => ({
    path: note.path,
    name: note.name,
    kind: "note",
    exists: true,
    ...note.createdAt !== void 0 ? { createdAt: note.createdAt } : {}
  })).sort((left, right) => comparePath(left.path, right.path));
  const edges = /* @__PURE__ */ new Map();
  const unresolvedNodes = /* @__PURE__ */ new Map();
  const tagNodes = /* @__PURE__ */ new Map();
  const linkIndex = buildWikiLinkIndex(notes, options.pathAliases);
  const attachments = options.attachments ?? [];
  const attachmentIndex = buildAttachmentLinkIndex(attachments);
  const attachmentNodes = options.includeAttachments ? attachments.map(
    (attachment) => ({
      path: attachment.path,
      name: attachment.name,
      kind: "attachment",
      exists: true,
      createdAt: attachment.createdAt
    })
  ) : [];
  for (const source of notes) {
    for (const link of extractWikiLinks(source.content)) {
      const linkTarget = link.target.trim().split("#", 1)[0];
      if (isSupportedAttachmentPath(linkTarget)) {
        if (!options.includeAttachments) {
          continue;
        }
        const resolution2 = resolveIndexedAttachmentLink(
          link.target,
          attachmentIndex
        );
        if (resolution2.status === "invalid" || resolution2.status === "ambiguous" || resolution2.status === "missing" && !options.includeUnresolved) {
          continue;
        }
        let targetPath2 = resolution2.path;
        if (resolution2.status === "missing") {
          const unresolvedKey = targetPath2.toLocaleLowerCase();
          const existing = unresolvedNodes.get(unresolvedKey);
          if (existing) {
            targetPath2 = existing.path;
          } else {
            unresolvedNodes.set(unresolvedKey, {
              path: targetPath2,
              name: basenameRelative(targetPath2),
              kind: "unresolved",
              exists: false
            });
          }
        }
        const edge2 = {
          sourcePath: source.path,
          targetPath: targetPath2
        };
        edges.set(`${edge2.sourcePath}\0${edge2.targetPath}`, edge2);
        continue;
      }
      const resolution = resolveIndexedWikiLink(link.target, linkIndex);
      if (resolution.status === "invalid" || resolution.status === "ambiguous") {
        continue;
      }
      if (resolution.status === "missing" && !options.includeUnresolved) {
        continue;
      }
      let targetPath = resolution.path;
      if (resolution.status === "missing") {
        targetPath = withoutMarkdownExtension(targetPath);
        const unresolvedKey = targetPath.toLocaleLowerCase();
        const existing = unresolvedNodes.get(unresolvedKey);
        if (existing) {
          targetPath = existing.path;
        } else {
          unresolvedNodes.set(unresolvedKey, {
            path: targetPath,
            name: withoutMarkdownExtension(basenameRelative(targetPath)),
            kind: "unresolved",
            exists: false
          });
        }
      }
      if (targetPath === source.path) {
        continue;
      }
      const edge = {
        sourcePath: source.path,
        targetPath
      };
      edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge);
    }
    if (options.includeTags) {
      for (const tag of extractMarkdownTags(source.content)) {
        const targetPath = `tag:${tag}`;
        tagNodes.set(targetPath, {
          path: targetPath,
          name: tag,
          kind: "tag",
          exists: true
        });
        const edge = {
          sourcePath: source.path,
          targetPath
        };
        edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge);
      }
    }
  }
  return {
    nodes: [
      ...nodes,
      ...unresolvedNodes.values(),
      ...tagNodes.values(),
      ...attachmentNodes
    ].sort((left, right) => comparePath(left.path, right.path)),
    edges: [...edges.values()].sort(
      (left, right) => comparePath(left.sourcePath, right.sourcePath) || comparePath(left.targetPath, right.targetPath)
    )
  };
}

// src/core/frontmatter.ts
var FRONTMATTER_PATTERN = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
var NESTED_YAML_LINE = /^\s+(?:-\s+.+|[A-Za-z_][A-Za-z0-9_-]*:(?:\s*.*)?)$/;
function parseScalar(value) {
  if (value === "" || value === "null" || value === "~") {
    return null;
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}
function parseFrontmatter(markdown) {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match) {
    if (/^(?:\uFEFF)?---(?:\r?\n|$)/.test(markdown)) {
      return {
        found: true,
        attributes: {},
        body: markdown,
        raw: null,
        warnings: [
          {
            code: "MALFORMED_FRONTMATTER",
            message: "Frontmatter closing delimiter is missing."
          }
        ]
      };
    }
    return {
      found: false,
      attributes: {},
      body: markdown,
      raw: null,
      warnings: []
    };
  }
  const attributes = {};
  const warnings = [];
  const lines = match[1].split(/\r?\n/);
  let nestedBlockOpen = false;
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }
    if (/^\s/.test(line)) {
      if (nestedBlockOpen && NESTED_YAML_LINE.test(line)) {
        continue;
      }
      warnings.push({
        code: "MALFORMED_FRONTMATTER",
        message: "Top-level key and scalar value are required.",
        line: index + 2
      });
      continue;
    }
    const field = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line);
    if (!field) {
      nestedBlockOpen = false;
      warnings.push({
        code: "MALFORMED_FRONTMATTER",
        message: "Top-level key and scalar value are required.",
        line: index + 2
      });
      continue;
    }
    const rawValue = field[2] ?? "";
    attributes[field[1]] = parseScalar(rawValue);
    nestedBlockOpen = rawValue.trim() === "";
  }
  return {
    found: true,
    attributes,
    body: markdown.slice(match[0].length),
    raw: match[0].replace(/\r?\n$/, ""),
    warnings
  };
}

// src/core/life-weather.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var STRATUM_DAYS = 7;
var FEATURE_COUNT = 128;
var MAX_CANDIDATES_PER_KIND = 24;
var LIFE_WEATHER_PHASE_AXES = [
  "boundaryExplicitness",
  "sourceBearing",
  "observationBearing",
  "proposalBearing",
  "revisionResidue",
  "provenanceTrace",
  "temporalTrace",
  "uncertainty"
];
function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function compareText(left, right) {
  return left.localeCompare(right, "ja") || (left < right ? -1 : left > right ? 1 : 0);
}
function round(value) {
  return Math.round(value * 1e6) / 1e6;
}
function contentFeatureCounts(content) {
  const counts = /* @__PURE__ */ new Map();
  const tokens = content.normalize("NFKC").toLocaleLowerCase().replace(/^---[\s\S]*?---/u, " ").match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    const features = token.length < 3 ? [token] : [token, ...Array.from(token).slice(0, -1).map((character, index, all) => `${character}${all[index + 1]}`)];
    for (const feature of features) counts.set(feature, (counts.get(feature) ?? 0) + 1);
  }
  return counts;
}
function contentFeatures(counts, documentFrequency, documentCount) {
  const vector = Array(FEATURE_COUNT).fill(0);
  for (const [feature, count] of counts) {
    const weight = count * Math.log((documentCount + 1) / ((documentFrequency.get(feature) ?? 0) + 1));
    const hash = stableHash(feature);
    vector[hash % FEATURE_COUNT] += (hash & 2147483648) === 0 ? weight : -weight;
  }
  const magnitude = Math.hypot(...vector);
  return magnitude === 0 ? vector : vector.map((value) => round(value / magnitude));
}
function cosine(left, right) {
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index];
  return Math.max(0, Math.min(1, value));
}
function finiteTime(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function phaseFeatures(note, maximumRevisionSpan) {
  const frontmatter = parseFrontmatter(note.content);
  const attributes = Object.fromEntries(
    Object.entries(frontmatter.attributes).map(([key, value]) => [key.toLocaleLowerCase(), value?.toLocaleLowerCase() ?? ""])
  );
  const boundaryKeys = ["type", "kind", "role", "status", "category", "layer"];
  const provenanceKeys = ["source", "sources", "origin", "provenance", "citation", "reference", "url"];
  const temporalKeys = ["observed_at", "created", "created_at", "updated", "updated_at", "valid_from", "date"];
  const metadata = Object.values(attributes).join(" ");
  const path = note.path.toLocaleLowerCase();
  const boundaryText = boundaryKeys.map((key) => attributes[key] ?? "").join(" ");
  const revisionSpan = Math.max(0, (finiteTime(note.modifiedAt) ?? 0) - (finiteTime(note.createdAt) ?? 0));
  const uncertaintySignal = /uncertain|unknown|unverified|provisional|draft|recheck|仮説|暫定|未確認|不明|要再確認/u.test(metadata);
  const signal = (pattern, fallback) => pattern.test(boundaryText) || fallback.test(path) ? 1 : 0;
  return {
    boundaryExplicitness: round(boundaryKeys.filter((key) => key in attributes).length / boundaryKeys.length),
    sourceBearing: signal(/source|reference|material|原典|資料/u, /(?:^|\/)40_|(?:^|\/)01_/u),
    observationBearing: signal(/observation|evidence|record|event|観測|記録|実施/u, /(?:^|\/)20_/u),
    proposalBearing: signal(/proposal|hypothesis|project|draft|提案|仮説|計画/u, /(?:^|\/)10_/u),
    revisionResidue: round(Math.log1p(revisionSpan / DAY_MS) / Math.max(1, Math.log1p(maximumRevisionSpan / DAY_MS))),
    provenanceTrace: round(provenanceKeys.filter((key) => key in attributes).length / provenanceKeys.length),
    temporalTrace: round(temporalKeys.filter((key) => key in attributes).length / temporalKeys.length),
    uncertainty: uncertaintySignal || frontmatter.warnings.length > 0 || note.createdAt === null ? 1 : 0
  };
}
function createLifeWeatherObservations(notes, graph) {
  const maximumRevisionSpan = Math.max(1, ...notes.map(
    (note) => Math.max(0, (finiteTime(note.modifiedAt) ?? 0) - (finiteTime(note.createdAt) ?? 0))
  ));
  const resolvedPaths = new Set(notes.map((note) => note.path));
  const linksBySource = /* @__PURE__ */ new Map();
  for (const edge of graph.edges) {
    if (!resolvedPaths.has(edge.sourcePath) || !resolvedPaths.has(edge.targetPath)) continue;
    const targets = linksBySource.get(edge.sourcePath) ?? [];
    targets.push(edge.targetPath);
    linksBySource.set(edge.sourcePath, targets);
  }
  const featureCounts = notes.map((note) => contentFeatureCounts(note.content));
  const documentFrequency = /* @__PURE__ */ new Map();
  for (const counts of featureCounts) {
    for (const feature of counts.keys()) documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1);
  }
  return notes.map((note, index) => {
    const linkTargets = [...new Set(linksBySource.get(note.path) ?? [])].sort(compareText);
    return {
      sourceNoteId: note.path,
      observedAt: finiteTime(note.createdAt),
      contentFeatures: contentFeatures(featureCounts[index], documentFrequency, notes.length),
      linkTargets,
      structureFeatures: {
        characterCount: Array.from(note.content).length,
        headingCount: note.content.split(/\r?\n/u).filter((line) => /^#{1,6}\s/u.test(line)).length,
        outboundLinkCount: linkTargets.length
      },
      phaseFeatures: phaseFeatures(note, maximumRevisionSpan)
    };
  });
}
function candidateId(kind, ids, suffix = "") {
  return `${kind}:${stableHash(`${ids.join("\0")}:${suffix}`).toString(16).padStart(8, "0")}`;
}
function meanPairSimilarity(observations) {
  if (observations.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let left = 0; left < observations.length; left += 1) {
    for (let right = left + 1; right < observations.length; right += 1) {
      total += cosine(observations[left].contentFeatures, observations[right].contentFeatures);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}
function createStrata(timed, origin) {
  const byIndex = /* @__PURE__ */ new Map();
  for (const observation of timed) {
    const index = Math.floor((observation.observedAt - origin) / (STRATUM_DAYS * DAY_MS));
    const entries = byIndex.get(index) ?? [];
    entries.push(observation);
    byIndex.set(index, entries);
  }
  const maximumCount = Math.max(1, ...[...byIndex.values()].map((entries) => entries.length));
  return [...byIndex.entries()].sort(([left], [right]) => left - right).map(([index, observations]) => {
    const earlier = timed.filter((entry) => entry.observedAt < origin + index * STRATUM_DAYS * DAY_MS);
    const novelty = earlier.length === 0 ? 1 : observations.reduce((sum, entry) => sum + 1 - Math.max(
      ...earlier.map((candidate) => cosine(entry.contentFeatures, candidate.contentFeatures))
    ), 0) / observations.length;
    return {
      index,
      start: origin + index * STRATUM_DAYS * DAY_MS,
      end: origin + (index + 1) * STRATUM_DAYS * DAY_MS,
      sourceNoteIds: observations.map((entry) => entry.sourceNoteId).sort(compareText),
      activityDensity: round(observations.length / maximumCount),
      contentNovelty: round(novelty),
      observations
    };
  });
}
function createLifeWeatherProfile(observations) {
  const timed = observations.filter((entry) => entry.observedAt !== null).sort((left, right) => left.observedAt - right.observedAt || compareText(left.sourceNoteId, right.sourceNoteId));
  const observedStart = timed[0]?.observedAt ?? null;
  const observedEnd = timed.at(-1)?.observedAt ?? null;
  const strata = observedStart === null ? [] : createStrata(timed, observedStart);
  const stratumByNote = new Map(strata.flatMap(
    (stratum) => stratum.sourceNoteIds.map((id) => [id, stratum.index])
  ));
  const sprouting = strata.filter((stratum) => stratum.sourceNoteIds.length >= 2 && (stratum.index === 0 || stratum.contentNovelty >= 0.35)).map((stratum) => ({
    id: candidateId("sprouting", stratum.sourceNoteIds, String(stratum.index)),
    kind: "sprouting",
    sourceNoteIds: stratum.sourceNoteIds,
    usedAttributes: ["observedAt", "contentFeatures"],
    evidence: {
      stratumIndex: stratum.index,
      noteCount: stratum.sourceNoteIds.length,
      activityDensity: stratum.activityDensity,
      contentNovelty: stratum.contentNovelty
    },
    selectionReasons: ["\u540C\u3058\u89B3\u6E2C\u5C64\u306B\u8907\u6570\u306E\u5206\u7BC0\u304C\u751F\u307E\u308C\u305F", "\u4EE5\u524D\u306E\u5C64\u3068\u306E\u5DEE\u7570\u3092\u4FDD\u3063\u3066\u3044\u308B"],
    uncertainty: ["\u89B3\u6E2C\u6642\u70B9\u306F\u771F\u306E\u57F7\u7B46\u6642\u70B9\u3084\u7D4C\u9A13\u6642\u70B9\u3092\u610F\u5473\u3057\u306A\u3044"]
  }));
  const recurrence = [];
  for (let right = 0; right < timed.length; right += 1) {
    const earlier = timed.slice(0, right).map((entry) => ({
      entry,
      separationDays: (timed[right].observedAt - entry.observedAt) / DAY_MS,
      similarity: cosine(entry.contentFeatures, timed[right].contentFeatures)
    })).filter((candidate) => candidate.separationDays >= STRATUM_DAYS).sort(
      (left, rightCandidate) => rightCandidate.similarity - left.similarity || rightCandidate.separationDays - left.separationDays || compareText(left.entry.sourceNoteId, rightCandidate.entry.sourceNoteId)
    )[0];
    if (!earlier || earlier.similarity < 0.3) continue;
    const ids = [earlier.entry.sourceNoteId, timed[right].sourceNoteId];
    recurrence.push({
      id: candidateId("recurrence", ids),
      kind: "recurrence",
      sourceNoteIds: ids,
      usedAttributes: ["observedAt", "contentFeatures"],
      evidence: { contentSimilarity: round(earlier.similarity), separationDays: round(earlier.separationDays) },
      selectionReasons: ["\u96E2\u308C\u305F\u89B3\u6E2C\u5C64\u3067\u6700\u3082\u8FD1\u3044\u5185\u5BB9\u7279\u5FB4\u304C\u518D\u3073\u73FE\u308C\u305F"],
      uncertainty: ["\u5185\u5BB9\u7279\u5FB4\u306E\u8FD1\u3055\u306F\u610F\u5473\u306E\u540C\u4E00\u6027\u3092\u78BA\u5B9A\u3057\u306A\u3044"]
    });
  }
  recurrence.sort(
    (left, right) => right.evidence.contentSimilarity - left.evidence.contentSimilarity || right.evidence.separationDays - left.evidence.separationDays || compareText(left.id, right.id)
  );
  const atmosphere = strata.filter((stratum) => stratum.observations.length >= 3).map((stratum) => ({ stratum, spread: 1 - meanPairSimilarity(stratum.observations) })).map(({ stratum, spread }) => ({
    id: candidateId("atmosphere", stratum.sourceNoteIds, String(stratum.index)),
    kind: "atmosphere",
    sourceNoteIds: stratum.sourceNoteIds,
    usedAttributes: ["observedAt", "contentFeatures", "structureFeatures"],
    evidence: {
      stratumIndex: stratum.index,
      noteCount: stratum.sourceNoteIds.length,
      contentSpread: round(spread),
      structureSpread: round(Math.max(...stratum.observations.map((entry) => entry.structureFeatures.headingCount)) - Math.min(...stratum.observations.map((entry) => entry.structureFeatures.headingCount)))
    },
    selectionReasons: ["\u540C\u3058\u89B3\u6E2C\u5C64\u306B\u7570\u306A\u308B\u5185\u5BB9\u3068\u69CB\u9020\u304C\u5171\u5B58\u3057\u305F"],
    uncertainty: ["\u540C\u6642\u671F\u6027\u3060\u3051\u3067\u306F\u30CE\u30FC\u30C8\u9593\u306E\u76F4\u63A5\u95A2\u4FC2\u3092\u610F\u5473\u3057\u306A\u3044"]
  }));
  const observationById = new Map(observations.map((entry) => [entry.sourceNoteId, entry]));
  const confluence = timed.flatMap((entry) => {
    const sourceStratum = stratumByNote.get(entry.sourceNoteId);
    const linkedOlder = entry.linkTargets.map((id) => observationById.get(id)).filter((target) => target?.observedAt !== null && target?.observedAt < entry.observedAt);
    const linkedStrata = new Set(linkedOlder.map((target) => stratumByNote.get(target.sourceNoteId)));
    linkedStrata.delete(void 0);
    if (sourceStratum === void 0 || linkedStrata.size < 2) return [];
    const ids = [entry.sourceNoteId, ...linkedOlder.map((target) => target.sourceNoteId).sort(compareText)];
    return [{
      id: candidateId("confluence", ids),
      kind: "confluence",
      sourceNoteIds: ids,
      usedAttributes: ["observedAt", "linkTargets"],
      evidence: { sourceStratum, linkedStrata: linkedStrata.size, linkCount: linkedOlder.length },
      selectionReasons: ["\u5F8C\u767A\u30CE\u30FC\u30C8\u304C\u8907\u6570\u306E\u4EE5\u524D\u306E\u89B3\u6E2C\u5C64\u3092\u660E\u793A\u7684\u306B\u7D50\u3093\u3060"],
      uncertainty: ["\u73FE\u5728\u306E\u30EA\u30F3\u30AF\u304B\u3089\u904E\u53BB\u306E\u30EA\u30F3\u30AF\u72B6\u614B\u306F\u5FA9\u5143\u3057\u306A\u3044"]
    }];
  });
  confluence.sort(
    (left, right) => right.evidence.linkedStrata - left.evidence.linkedStrata || right.evidence.linkCount - left.evidence.linkCount || compareText(left.id, right.id)
  );
  return {
    version: 1,
    source: {
      noteCount: observations.length,
      timedNoteCount: timed.length,
      untimedNoteCount: observations.length - timed.length,
      observedStart,
      observedEnd
    },
    strata: strata.map(({ observations: _observations, ...stratum }) => stratum),
    phenomena: {
      sprouting: sprouting.slice(0, MAX_CANDIDATES_PER_KIND),
      recurrence: recurrence.slice(0, MAX_CANDIDATES_PER_KIND),
      atmosphere: atmosphere.slice(0, MAX_CANDIDATES_PER_KIND),
      confluence: confluence.slice(0, MAX_CANDIDATES_PER_KIND)
    },
    omittedPhenomenonCounts: {
      sprouting: Math.max(0, sprouting.length - MAX_CANDIDATES_PER_KIND),
      recurrence: Math.max(0, recurrence.length - MAX_CANDIDATES_PER_KIND),
      atmosphere: Math.max(0, atmosphere.length - MAX_CANDIDATES_PER_KIND),
      confluence: Math.max(0, confluence.length - MAX_CANDIDATES_PER_KIND)
    },
    limitations: [
      "\u89B3\u6E2C\u6642\u70B9\u306F\u771F\u306E\u57F7\u7B46\u6642\u70B9\u30FB\u7D4C\u9A13\u6642\u70B9\u30FB\u53D6\u8FBC\u6642\u70B9\u3092\u533A\u5225\u3057\u306A\u3044",
      "\u6642\u70B9\u4E0D\u660E\u306E\u30CE\u30FC\u30C8\u3092\u6642\u9593\u73FE\u8C61\u306E\u6839\u62E0\u306B\u4F7F\u7528\u3057\u306A\u3044",
      "\u73FE\u5728\u306E\u30EA\u30F3\u30AF\u304B\u3089\u904E\u53BB\u306E\u95A2\u4FC2\u72B6\u614B\u3092\u5FA9\u5143\u3057\u306A\u3044",
      "\u5019\u88DC\u306F\u5B58\u5728\u76F8\u305D\u306E\u3082\u306E\u3067\u306F\u306A\u304F\u73FE\u5728\u6761\u4EF6\u306B\u3088\u308B\u5C40\u6240\u7684\u306A\u89B3\u6E2C\u8868\u73FE\u3067\u3042\u308B"
    ]
  };
}
function shuffleLifeWeatherTrack(observations, track, seed) {
  if (observations.length < 2) return observations.map((entry) => ({ ...entry }));
  const offset = 1 + stableHash(seed) % (observations.length - 1);
  return observations.map((entry, index) => {
    const donor = observations[(index + offset) % observations.length];
    if (track === "time") return { ...entry, observedAt: donor.observedAt };
    if (track === "content") return { ...entry, contentFeatures: [...donor.contentFeatures] };
    return { ...entry, structureFeatures: { ...donor.structureFeatures } };
  });
}
function withoutLifeWeatherLinks(observations) {
  return observations.map((entry) => ({
    ...entry,
    linkTargets: [],
    structureFeatures: { ...entry.structureFeatures, outboundLinkCount: 0 }
  }));
}

// src/main/vault.ts
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { randomUUID } from "node:crypto";

// src/shared/excluded-files.ts
function escapeRegularExpression(value) {
  return value.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}
function compilePattern(value) {
  const pattern = value.trim();
  if (!pattern) {
    return null;
  }
  try {
    return pattern.length > 2 && pattern.startsWith("/") && pattern.endsWith("/") ? new RegExp(pattern.slice(1, -1), "i") : new RegExp(`^${escapeRegularExpression(pattern)}`, "i");
  } catch {
    return null;
  }
}
function parseUserIgnoreFilters(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function createExcludedFileMatcher(patterns) {
  const compiled = patterns.map(compilePattern).filter((pattern) => pattern !== null);
  return (path) => compiled.some((pattern) => pattern.test(path));
}
function isExcludedFilePath(path, patterns) {
  return createExcludedFileMatcher(patterns)(path);
}

// src/shared/ai-write-policy.ts
var AUDIT_HISTORY_PATHS = ["50_\u5C65\u6B74"];
function isAuditHistoryPath(path) {
  return isExcludedFilePath(path, AUDIT_HISTORY_PATHS);
}

// src/core/path-aliases.ts
function pathKey(path) {
  return path.toLocaleLowerCase();
}
function markdownPath(value, role) {
  if (typeof value !== "string") {
    throw new Error(`${role}\u306F\u6587\u5B57\u5217\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  }
  const validation = validateRelativePath(value);
  if (!validation.valid || !validation.normalized || !validation.normalized.toLocaleLowerCase().endsWith(".md")) {
    throw new Error(
      `${role}\u306F\u5B89\u5168\u306AVault\u76F8\u5BFEMarkdown\u30D1\u30B9\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044: ${value}`
    );
  }
  return validation.normalized;
}
function compilePathAliases(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("\u30D1\u30B9alias\u8A2D\u5B9A\u306F\u65E7\u30D1\u30B9\u3068\u65B0\u30D1\u30B9\u306EJSON object\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }
  const direct = /* @__PURE__ */ new Map();
  const sourcePaths = /* @__PURE__ */ new Map();
  for (const [rawSource, rawTarget] of Object.entries(value)) {
    const source = markdownPath(rawSource, "\u65E7\u30D1\u30B9");
    const target = markdownPath(rawTarget, "\u65B0\u30D1\u30B9");
    const sourceKey = pathKey(source);
    const previousSource = sourcePaths.get(sourceKey);
    if (previousSource) {
      throw new Error(
        `\u5927\u6587\u5B57\u5C0F\u6587\u5B57\u3092\u533A\u5225\u3057\u306A\u3044\u65E7\u30D1\u30B9\u304C\u885D\u7A81\u3057\u3066\u3044\u307E\u3059: ${previousSource}, ${source}`
      );
    }
    sourcePaths.set(sourceKey, source);
    direct.set(sourceKey, target);
  }
  const terminalPaths = /* @__PURE__ */ new Map();
  for (const target of direct.values()) {
    const targetKey = pathKey(target);
    if (direct.has(targetKey)) {
      continue;
    }
    const previousTarget = terminalPaths.get(targetKey);
    if (previousTarget && previousTarget !== target) {
      throw new Error(
        `\u5927\u6587\u5B57\u5C0F\u6587\u5B57\u3092\u533A\u5225\u3057\u306A\u3044canonical path\u304C\u885D\u7A81\u3057\u3066\u3044\u307E\u3059: ${previousTarget}, ${target}`
      );
    }
    terminalPaths.set(targetKey, target);
  }
  const flattened = /* @__PURE__ */ new Map();
  const visiting = /* @__PURE__ */ new Set();
  const flatten = (sourceKey) => {
    const resolved = flattened.get(sourceKey);
    if (resolved) {
      return resolved;
    }
    if (visiting.has(sourceKey)) {
      throw new Error(
        `\u30D1\u30B9alias\u306B\u5FAA\u74B0\u304C\u3042\u308A\u307E\u3059: ${sourcePaths.get(sourceKey) ?? sourceKey}`
      );
    }
    visiting.add(sourceKey);
    const target = direct.get(sourceKey);
    const targetKey = pathKey(target);
    const canonical = direct.has(targetKey) ? flatten(targetKey) : target;
    visiting.delete(sourceKey);
    flattened.set(sourceKey, canonical);
    return canonical;
  };
  for (const sourceKey of direct.keys()) {
    flatten(sourceKey);
  }
  return { flattened };
}
function resolvePathAlias(aliases, rawPath) {
  const path = markdownPath(rawPath, "\u89E3\u6C7A\u5BFE\u8C61\u30D1\u30B9");
  return aliases.flattened.get(pathKey(path)) ?? path;
}

// src/main/vault.ts
var VaultError = class extends Error {
  constructor(appError, options) {
    super(appError.message, options);
    this.appError = appError;
  }
};
function fromNodeError(error, fallback, message) {
  if (error instanceof VaultError) {
    return error;
  }
  const nodeError = error;
  let code = fallback;
  if (nodeError?.code === "ENOENT") {
    code = "NOT_FOUND";
  } else if (nodeError?.code === "EACCES" || nodeError?.code === "EPERM") {
    code = "ACCESS_DENIED";
  } else if (nodeError?.code === "EEXIST") {
    code = "ALREADY_EXISTS";
  }
  return new VaultError(
    {
      code,
      message
    },
    { cause: error }
  );
}
function isMarkdownFile(path) {
  return extname(path).toLocaleLowerCase() === ".md";
}
var IMAGE_MIME_TYPES = /* @__PURE__ */ new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".avif", "image/avif"]
]);
function validBirthtime(birthtimeMs) {
  return Number.isFinite(birthtimeMs) && birthtimeMs > 0 ? birthtimeMs : null;
}
var SCAN_BATCH_SIZE = 16;
async function mapScanFiles(items, mapper) {
  const results = [];
  for (let start = 0; start < items.length; start += SCAN_BATCH_SIZE) {
    const batch = items.slice(start, start + SCAN_BATCH_SIZE);
    results.push(...await Promise.all(batch.map(mapper)));
  }
  return results;
}
function validCreationTime(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function normalizeCreationTimes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [path, timestamp] of Object.entries(value)) {
    const validation = validateRelativePath(path);
    if (validation.valid && validation.normalized && validCreationTime(timestamp)) {
      normalized[validation.normalized] = timestamp;
    }
  }
  return normalized;
}
function normalizeBookmarks(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const bookmarks = /* @__PURE__ */ new Map();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item;
    const validation = typeof candidate.path === "string" ? validateRelativePath(candidate.path) : { valid: false };
    if (candidate.type !== "file" || !validation.valid || !validation.normalized || !validCreationTime(candidate.ctime)) {
      continue;
    }
    bookmarks.set(validation.normalized, {
      type: "file",
      path: validation.normalized,
      ...typeof candidate.title === "string" && candidate.title.trim() ? { title: candidate.title.trim() } : {},
      ...typeof candidate.group === "string" && candidate.group.trim() ? { group: candidate.group.trim() } : {},
      ctime: candidate.ctime
    });
  }
  return [...bookmarks.values()].sort((left, right) => left.ctime - right.ctime);
}
function timestampSuffix(date = /* @__PURE__ */ new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    "-",
    pad(date.getMilliseconds(), 3)
  ].join("");
}
var VaultService = class {
  rootPath = null;
  rootRevision = 0;
  creationTimeQueue = Promise.resolve();
  getRootPath() {
    return this.rootPath;
  }
  async setRootPath(rootPath) {
    const info = await lstat(rootPath);
    if (info.isSymbolicLink()) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u30B7\u30F3\u30DC\u30EA\u30C3\u30AF\u30EA\u30F3\u30AF\u3084\u30B8\u30E3\u30F3\u30AF\u30B7\u30E7\u30F3\u306FVault\u306B\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    if (!info.isDirectory()) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u9078\u629E\u3057\u305F\u5834\u6240\u306F\u30D5\u30A9\u30EB\u30C0\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002"
      });
    }
    this.rootPath = resolve(rootPath);
    this.rootRevision += 1;
  }
  clearRootPath() {
    if (this.rootPath) {
      this.rootRevision += 1;
    }
    this.rootPath = null;
  }
  requireRoot() {
    if (!this.rootPath) {
      throw new VaultError({
        code: "NO_VAULT",
        message: "\u5148\u306BVault\u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    return this.rootPath;
  }
  absolutePath(relativePath, allowRoot = false) {
    const root = this.requireRoot();
    if (relativePath === "" && allowRoot) {
      return root;
    }
    const validation = validateRelativePath(relativePath);
    if (!validation.valid || !validation.normalized) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: validation.reason ?? "Vault\u5185\u306E\u6709\u52B9\u306A\u30D1\u30B9\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    const absolute = resolve(root, ...validation.normalized.split("/"));
    const fromRoot = relative(root, absolute);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Vault\u5916\u306E\u30D1\u30B9\u306F\u64CD\u4F5C\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    return absolute;
  }
  relativePath(absolutePath) {
    return relative(this.requireRoot(), absolutePath).split(sep).join("/");
  }
  relativePathFrom(rootPath, absolutePath) {
    return relative(rootPath, absolutePath).split(sep).join("/");
  }
  async assertNoSymlinkTraversal(targetPath, allowMissing = false) {
    const root = this.requireRoot();
    const fromRoot = relative(root, targetPath);
    const parts = fromRoot.split(sep).filter(Boolean);
    let current = root;
    for (const part of parts) {
      current = join(current, part);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) {
          throw new VaultError({
            code: "INVALID_PATH",
            message: "\u30B7\u30F3\u30DC\u30EA\u30C3\u30AF\u30EA\u30F3\u30AF\u3084\u30B8\u30E3\u30F3\u30AF\u30B7\u30E7\u30F3\u7D4C\u7531\u306E\u64CD\u4F5C\u306F\u3067\u304D\u307E\u305B\u3093\u3002"
          });
        }
      } catch (error) {
        if (allowMissing && error.code === "ENOENT") {
          return;
        }
        throw error;
      }
    }
  }
  async ensureDestinationAvailable(source, destination) {
    if (source === destination) {
      return;
    }
    try {
      await lstat(destination);
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    throw new VaultError({
      code: "ALREADY_EXISTS",
      message: "\u540C\u3058\u540D\u524D\u306E\u9805\u76EE\u304C\u3059\u3067\u306B\u3042\u308A\u307E\u3059\u3002"
    });
  }
  async findAvailableMoveDestination(source, destination) {
    if (source === destination) {
      return destination;
    }
    const extension = extname(destination);
    const name = basename(destination, extension);
    for (let suffix = 0; ; suffix += 1) {
      const candidate = suffix === 0 ? destination : join(dirname(destination), `${name} ${suffix}${extension}`);
      try {
        await lstat(candidate);
      } catch (error) {
        if (error.code === "ENOENT") {
          return candidate;
        }
        throw error;
      }
    }
  }
  isCurrentRoot(rootPath, revision) {
    return this.rootPath === rootPath && this.rootRevision === revision;
  }
  async readCreationTimes(rootPath) {
    const metadataDirectory = join(rootPath, ".tsuzune");
    const registryPath = join(metadataDirectory, "graph-file-times.json");
    try {
      const [directoryInfo, registryInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(registryPath)
      ]);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || !registryInfo.isFile() || registryInfo.isSymbolicLink()) {
        return {};
      }
      return normalizeCreationTimes(JSON.parse(await readFile(registryPath, "utf8")));
    } catch {
      return {};
    }
  }
  async readBookmarks(rootPath) {
    const metadataDirectory = join(rootPath, ".tsuzune");
    const bookmarkPath = join(metadataDirectory, "bookmarks.json");
    try {
      const [directoryInfo, bookmarkInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(bookmarkPath)
      ]);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || !bookmarkInfo.isFile() || bookmarkInfo.isSymbolicLink()) {
        return [];
      }
      return normalizeBookmarks(JSON.parse(await readFile(bookmarkPath, "utf8")));
    } catch {
      return [];
    }
  }
  async readPathAliases(rootPath) {
    const metadataDirectory = join(rootPath, ".tsuzune");
    const aliasPath = join(metadataDirectory, "path-aliases.json");
    try {
      const [directoryInfo, aliasInfo] = await Promise.all([
        lstat(metadataDirectory),
        lstat(aliasPath)
      ]);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || !aliasInfo.isFile() || aliasInfo.isSymbolicLink()) {
        throw new Error("path-aliases.json must be a regular file.");
      }
      const parsed = JSON.parse(await readFile(aliasPath, "utf8"));
      compilePathAliases(parsed);
      return { ...parsed };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      throw new VaultError(
        {
          code: "INVALID_PATH",
          message: ".tsuzune/path-aliases.json\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        },
        { cause: error }
      );
    }
  }
  async bookmarkMatchesPath(bookmarkPath, targetPath, aliases) {
    if (bookmarkPath.toLocaleLowerCase() === targetPath.toLocaleLowerCase()) {
      return true;
    }
    if (!isMarkdownFile(bookmarkPath)) {
      return false;
    }
    try {
      const absolute = this.absolutePath(bookmarkPath);
      await this.assertNoSymlinkTraversal(absolute);
      if ((await stat(absolute)).isFile()) {
        return false;
      }
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof VaultError && error.appError.code === "INVALID_PATH")) {
        throw error;
      }
    }
    return resolvePathAlias(aliases, bookmarkPath).toLocaleLowerCase() === targetPath.toLocaleLowerCase();
  }
  async writeBookmarks(rootPath, revision, bookmarks) {
    if (!this.isCurrentRoot(rootPath, revision)) {
      throw new VaultError({
        code: "NO_VAULT",
        message: "Vault\u304C\u5207\u308A\u66FF\u308F\u3063\u305F\u305F\u3081\u3001\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002"
      });
    }
    const metadataDirectory = join(rootPath, ".tsuzune");
    const bookmarkPath = join(metadataDirectory, "bookmarks.json");
    const temporaryPath = join(metadataDirectory, `.bookmarks-${randomUUID()}.tmp`);
    try {
      await mkdir(metadataDirectory, { recursive: true });
      const directoryInfo = await lstat(metadataDirectory);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "TSUZUNE\u306E\u30E1\u30BF\u30C7\u30FC\u30BF\u4FDD\u5B58\u5148\u3092\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002"
        });
      }
      await writeFile(
        temporaryPath,
        `${JSON.stringify(normalizeBookmarks(bookmarks), null, 2)}
`,
        { encoding: "utf8", flag: "wx" }
      );
      if (!this.isCurrentRoot(rootPath, revision)) {
        throw new VaultError({
          code: "NO_VAULT",
          message: "Vault\u304C\u5207\u308A\u66FF\u308F\u3063\u305F\u305F\u3081\u3001\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002"
        });
      }
      await rename(temporaryPath, bookmarkPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => void 0);
      throw error;
    }
  }
  async writeCreationTimes(rootPath, revision, creationTimes) {
    if (!this.isCurrentRoot(rootPath, revision)) {
      return;
    }
    const metadataDirectory = join(rootPath, ".tsuzune");
    const registryPath = join(metadataDirectory, "graph-file-times.json");
    const temporaryPath = join(
      metadataDirectory,
      `.graph-file-times-${randomUUID()}.tmp`
    );
    try {
      await mkdir(metadataDirectory, { recursive: true });
      const directoryInfo = await lstat(metadataDirectory);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
        return;
      }
      const sorted = Object.fromEntries(
        Object.entries(normalizeCreationTimes(creationTimes)).sort(
          ([left], [right]) => left.localeCompare(right, "ja")
        )
      );
      const serialized = `${JSON.stringify(sorted, null, 2)}
`;
      try {
        const registryInfo = await lstat(registryPath);
        if (registryInfo.isFile() && !registryInfo.isSymbolicLink() && await readFile(registryPath, "utf8") === serialized) {
          return;
        }
      } catch {
      }
      await writeFile(temporaryPath, serialized, {
        encoding: "utf8",
        flag: "wx"
      });
      if (!this.isCurrentRoot(rootPath, revision)) {
        await rm(temporaryPath, { force: true });
        return;
      }
      await rename(temporaryPath, registryPath);
    } catch {
      await rm(temporaryPath, { force: true }).catch(() => void 0);
    }
  }
  async updateCreationTimes(rootPath, revision, update) {
    let result = {};
    const operation = this.creationTimeQueue.then(async () => {
      if (!this.isCurrentRoot(rootPath, revision)) {
        return;
      }
      const current = await this.readCreationTimes(rootPath);
      if (!this.isCurrentRoot(rootPath, revision)) {
        return;
      }
      result = normalizeCreationTimes(update(current));
      await this.writeCreationTimes(rootPath, revision, result);
    });
    this.creationTimeQueue = operation.catch(() => void 0);
    await operation.catch(() => void 0);
    return result;
  }
  async moveCreationTimes(rootPath, revision, oldPath, newPath, directory) {
    await this.updateCreationTimes(rootPath, revision, (current) => {
      const next = { ...current };
      for (const [path, timestamp] of Object.entries(current)) {
        if (path !== oldPath && (!directory || !path.startsWith(`${oldPath}/`))) {
          continue;
        }
        const suffix = path.slice(oldPath.length);
        delete next[path];
        next[`${newPath}${suffix}`] = timestamp;
      }
      return next;
    });
  }
  async removeCreationTimes(rootPath, revision, removedPath) {
    await this.updateCreationTimes(
      rootPath,
      revision,
      (current) => Object.fromEntries(
        Object.entries(current).filter(
          ([path]) => path !== removedPath && !path.startsWith(`${removedPath}/`)
        )
      )
    );
  }
  async scan(userIgnoreFilters = [], { persistCreationTimes = true } = {}) {
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const directories = [""];
    const notePaths = [];
    const attachmentPaths = [];
    const walk = async (absoluteDirectory) => {
      let entries;
      try {
        entries = await readdir(absoluteDirectory, { withFileTypes: true });
      } catch (error) {
        throw fromNodeError(error, "UNKNOWN", "Vault\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.isSymbolicLink()) {
          continue;
        }
        const absolute = join(absoluteDirectory, entry.name);
        if (entry.isDirectory()) {
          directories.push(this.relativePathFrom(root, absolute));
          await walk(absolute);
        } else if (entry.isFile() && isMarkdownFile(entry.name)) {
          notePaths.push(absolute);
        } else if (entry.isFile() && isSupportedAttachmentPath(entry.name)) {
          attachmentPaths.push(absolute);
        }
      }
    };
    await walk(root);
    const notes = await mapScanFiles(
      notePaths,
      async (absolutePath) => {
        const [content, info] = await Promise.all([
          readFile(absolutePath, "utf8"),
          stat(absolutePath)
        ]);
        const relativePath = this.relativePathFrom(root, absolutePath);
        return {
          path: relativePath,
          name: withoutMarkdownExtension(basenameRelative(relativePath)),
          content,
          modifiedAt: info.mtimeMs,
          createdAt: validBirthtime(info.birthtimeMs),
          size: info.size
        };
      }
    );
    const attachments = await mapScanFiles(
      attachmentPaths,
      async (absolutePath) => {
        const info = await stat(absolutePath);
        const relativePath = this.relativePathFrom(root, absolutePath);
        return {
          path: relativePath,
          name: basenameRelative(relativePath),
          modifiedAt: info.mtimeMs,
          createdAt: validBirthtime(info.birthtimeMs),
          size: info.size
        };
      }
    );
    if (this.rootRevision !== revision || this.rootPath !== root) {
      throw new VaultError({
        code: "NO_VAULT",
        message: "Vault\u304C\u5207\u308A\u66FF\u308F\u3063\u305F\u305F\u3081\u3001\u53E4\u3044\u8AAD\u307F\u8FBC\u307F\u7D50\u679C\u3092\u7834\u68C4\u3057\u307E\u3057\u305F\u3002"
      });
    }
    const pathAliases = await this.readPathAliases(root);
    const reconcileCreationTimes = (current) => {
      const next = {};
      for (const item of [...notes, ...attachments]) {
        const timestamp = current[item.path] ?? item.createdAt;
        if (validCreationTime(timestamp)) {
          next[item.path] = timestamp;
        }
      }
      return next;
    };
    const creationTimesPromise = persistCreationTimes ? this.updateCreationTimes(root, revision, reconcileCreationTimes) : this.readCreationTimes(root).then(reconcileCreationTimes);
    const [creationTimes, bookmarks] = await Promise.all([
      creationTimesPromise,
      this.readBookmarks(root)
    ]);
    if (this.rootRevision !== revision || this.rootPath !== root) {
      throw new VaultError({
        code: "NO_VAULT",
        message: "Vault\u304C\u5207\u308A\u66FF\u308F\u3063\u305F\u305F\u3081\u3001\u53E4\u3044\u8AAD\u307F\u8FBC\u307F\u7D50\u679C\u3092\u7834\u68C4\u3057\u307E\u3057\u305F\u3002"
      });
    }
    for (const item of [...notes, ...attachments]) {
      item.createdAt = creationTimes[item.path] ?? item.createdAt;
    }
    const isExcluded = createExcludedFileMatcher(userIgnoreFilters);
    const visibleDirectories = directories.filter(
      (directory) => !directory || !isExcluded(directory) && !isExcluded(`${directory}/`)
    );
    const visibleNotes = notes.filter((item) => !isExcluded(item.path));
    const visibleAttachments = attachments.filter((item) => !isExcluded(item.path));
    visibleDirectories.sort((left, right) => left.localeCompare(right, "ja"));
    visibleNotes.sort((left, right) => left.path.localeCompare(right.path, "ja"));
    visibleAttachments.sort((left, right) => left.path.localeCompare(right.path, "ja"));
    const compiledAliases = compilePathAliases(pathAliases);
    const liveNotePaths = new Map(
      visibleNotes.map((note) => [note.path.toLocaleLowerCase(), note.path])
    );
    const resolvedBookmarks = normalizeBookmarks(
      bookmarks.map((bookmark) => {
        if (!isMarkdownFile(bookmark.path)) {
          return bookmark;
        }
        const liveExactPath = liveNotePaths.get(bookmark.path.toLocaleLowerCase());
        if (liveExactPath) {
          return { ...bookmark, path: liveExactPath };
        }
        const canonicalPath = resolvePathAlias(compiledAliases, bookmark.path);
        const liveCanonicalPath = liveNotePaths.get(canonicalPath.toLocaleLowerCase());
        return liveCanonicalPath ? { ...bookmark, path: liveCanonicalPath } : bookmark;
      })
    );
    return {
      rootPath: root,
      rootName: basename(root),
      directories: visibleDirectories,
      notes: visibleNotes,
      attachments: visibleAttachments,
      bookmarks: resolvedBookmarks,
      pathAliases
    };
  }
  async saveBookmark(input) {
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const absolute = this.absolutePath(input.path);
    try {
      await this.assertNoSymlinkTraversal(absolute);
      const info = await stat(absolute);
      if (!info.isFile()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3067\u304D\u307E\u3059\u3002"
        });
      }
      const path = this.relativePathFrom(root, absolute);
      const current = await this.readBookmarks(root);
      const aliases = compilePathAliases(await this.readPathAliases(root));
      const matches = await Promise.all(
        current.map(
          (bookmark2) => this.bookmarkMatchesPath(bookmark2.path, path, aliases)
        )
      );
      const previous = current.find((_, index) => matches[index]);
      const title = input.title?.trim();
      const group = input.group?.trim();
      const bookmark = {
        type: "file",
        path,
        ...title ? { title } : {},
        ...group ? { group } : {},
        ctime: previous?.ctime ?? Date.now()
      };
      await this.writeBookmarks(root, revision, [
        ...current.filter((_, index) => !matches[index]),
        bookmark
      ]);
      return bookmark;
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      throw fromNodeError(error, "SAVE_FAILED", "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async removeBookmark(path) {
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const absolute = this.absolutePath(path);
    const normalizedPath = this.relativePathFrom(root, absolute);
    try {
      const current = await this.readBookmarks(root);
      const aliases = compilePathAliases(await this.readPathAliases(root));
      const matches = await Promise.all(
        current.map(
          (bookmark) => this.bookmarkMatchesPath(bookmark.path, normalizedPath, aliases)
        )
      );
      await this.writeBookmarks(
        root,
        revision,
        current.filter((_, index) => !matches[index])
      );
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      throw fromNodeError(error, "SAVE_FAILED", "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async readNote(relativePath) {
    if (!isMarkdownFile(relativePath)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Markdown\u30CE\u30FC\u30C8\u3060\u3051\u3092\u958B\u3051\u307E\u3059\u3002"
      });
    }
    const root = this.requireRoot();
    const absolute = this.absolutePath(relativePath);
    try {
      await this.assertNoSymlinkTraversal(absolute);
      const [content, info] = await Promise.all([
        readFile(absolute, "utf8"),
        stat(absolute)
      ]);
      const normalizedPath = this.relativePathFrom(root, absolute);
      const creationTimes = await this.readCreationTimes(root);
      return {
        path: normalizedPath,
        name: withoutMarkdownExtension(basenameRelative(relativePath)),
        content,
        modifiedAt: info.mtimeMs,
        createdAt: creationTimes[normalizedPath] ?? validBirthtime(info.birthtimeMs),
        size: info.size
      };
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u30CE\u30FC\u30C8\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async resolveFileForOpen(relativePath) {
    if (!isMarkdownFile(relativePath) && !isSupportedAttachmentPath(relativePath)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Markdown\u30CE\u30FC\u30C8\u307E\u305F\u306F\u5BFE\u5FDC\u3059\u308B\u6DFB\u4ED8\u66F8\u985E\u3060\u3051\u3092\u958B\u3051\u307E\u3059\u3002"
      });
    }
    const absolute = this.absolutePath(relativePath);
    try {
      await this.assertNoSymlinkTraversal(absolute);
      const info = await stat(absolute);
      if (!info.isFile()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u958B\u3051\u307E\u3059\u3002"
        });
      }
      return absolute;
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u30D5\u30A1\u30A4\u30EB\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async resolveEntryForReveal(relativePath) {
    const absolute = this.absolutePath(relativePath);
    try {
      await this.assertNoSymlinkTraversal(absolute);
      const info = await stat(absolute);
      if (!info.isDirectory() && (!info.isFile() || !isMarkdownFile(relativePath) && !isSupportedAttachmentPath(relativePath))) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "Vault\u5185\u306E\u30CE\u30FC\u30C8\u3001\u6DFB\u4ED8\u66F8\u985E\u3001\u30D5\u30A9\u30EB\u30C0\u30FC\u3060\u3051\u3092\u8868\u793A\u3067\u304D\u307E\u3059\u3002"
        });
      }
      return absolute;
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u9805\u76EE\u3092\u8868\u793A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async readImageDataUrl(relativePath) {
    const mimeType = IMAGE_MIME_TYPES.get(extname(relativePath).toLocaleLowerCase());
    if (!mimeType) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u5BFE\u5FDC\u3059\u308B\u753B\u50CF\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u30D7\u30EC\u30D3\u30E5\u30FC\u3067\u304D\u307E\u3059\u3002"
      });
    }
    const absolutePath = await this.resolveFileForOpen(relativePath);
    try {
      return `data:${mimeType};base64,${(await readFile(absolutePath)).toString("base64")}`;
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u753B\u50CF\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async readAttachmentBytes(relativePath) {
    if (!isSupportedAttachmentPath(relativePath)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u5BFE\u5FDC\u3059\u308B\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u3059\u3002"
      });
    }
    const absolutePath = await this.resolveFileForOpen(relativePath);
    try {
      return await readFile(absolutePath);
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async saveAttachment(input) {
    if (!isSupportedAttachmentPath(input.path)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u5BFE\u5FDC\u3059\u308B\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u4FDD\u5B58\u3067\u304D\u307E\u3059\u3002"
      });
    }
    const absolute = this.absolutePath(input.path);
    const temporaryPath = join(
      dirname(absolute),
      `.tsuzune-${basename(absolute)}-${randomUUID()}.tmp`
    );
    try {
      await this.assertNoSymlinkTraversal(absolute, true);
      let currentInfo = null;
      try {
        currentInfo = await stat(absolute);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (currentInfo) {
        if (!currentInfo.isFile()) {
          throw new VaultError({
            code: "INVALID_PATH",
            message: "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u306E\u4FDD\u5B58\u5148\u304C\u901A\u5E38\u306E\u30D5\u30A1\u30A4\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002"
          });
        }
        if (input.expectedModifiedAt === void 0 && input.expectedContent === void 0) {
          throw new VaultError({
            code: "ALREADY_EXISTS",
            message: "\u540C\u3058\u5834\u6240\u306B\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u304C\u3042\u308A\u307E\u3059\u3002"
          });
        }
        const currentContent = await readFile(absolute);
        if (input.expectedModifiedAt !== void 0 && Math.abs(currentInfo.mtimeMs - input.expectedModifiedAt) > 0.5 || input.expectedContent !== void 0 && !currentContent.equals(input.expectedContent)) {
          throw new VaultError({
            code: "FILE_CHANGED",
            message: "\u3053\u306E\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u306F\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002",
            currentModifiedAt: currentInfo.mtimeMs
          });
        }
      }
      await writeFile(temporaryPath, input.content, { flag: "wx" });
      if (currentInfo) {
        await this.assertNoSymlinkTraversal(absolute);
        const latestInfo = await stat(absolute);
        const latestContent = await readFile(absolute);
        if (Math.abs(latestInfo.mtimeMs - currentInfo.mtimeMs) > 0.5 || latestInfo.size !== currentInfo.size || input.expectedContent !== void 0 && !latestContent.equals(input.expectedContent)) {
          throw new VaultError({
            code: "FILE_CHANGED",
            message: "\u4FDD\u5B58\u4E2D\u306B\u3001\u3053\u306E\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u304C\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002",
            currentModifiedAt: latestInfo.mtimeMs
          });
        }
        await rename(temporaryPath, absolute);
      } else {
        await copyFile(temporaryPath, absolute, fsConstants.COPYFILE_EXCL);
        await rm(temporaryPath, { force: true });
      }
      const savedInfo = await stat(absolute);
      return {
        path: input.path,
        modifiedAt: savedInfo.mtimeMs,
        size: savedInfo.size
      };
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => void 0);
      if (error instanceof VaultError) throw error;
      throw fromNodeError(error, "SAVE_FAILED", "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async saveNote(input) {
    if (!isMarkdownFile(input.path)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Markdown\u30CE\u30FC\u30C8\u3060\u3051\u3092\u4FDD\u5B58\u3067\u304D\u307E\u3059\u3002"
      });
    }
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const absolute = this.absolutePath(input.path);
    try {
      await this.assertNoSymlinkTraversal(absolute);
      const currentInfo = await stat(absolute);
      const normalizedPath = this.relativePathFrom(root, absolute);
      if (!input.force && Math.abs(currentInfo.mtimeMs - input.expectedModifiedAt) > 0.5) {
        const currentContent = await readFile(absolute, "utf8");
        throw new VaultError({
          code: "FILE_CHANGED",
          message: "\u3053\u306E\u30CE\u30FC\u30C8\u306F\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002",
          currentContent,
          currentModifiedAt: currentInfo.mtimeMs
        });
      }
      const initialContent = await readFile(absolute, "utf8");
      if (!input.force && input.expectedContent !== void 0 && initialContent !== input.expectedContent) {
        throw new VaultError({
          code: "FILE_CHANGED",
          message: "\u3053\u306E\u30CE\u30FC\u30C8\u306F\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002",
          currentContent: initialContent,
          currentModifiedAt: currentInfo.mtimeMs
        });
      }
      await this.updateCreationTimes(root, revision, (current) => {
        const timestamp = current[normalizedPath] ?? validBirthtime(currentInfo.birthtimeMs);
        return validCreationTime(timestamp) ? { ...current, [normalizedPath]: timestamp } : current;
      });
      const temporaryPath = join(
        dirname(absolute),
        `.tsuzune-${basename(absolute)}-${randomUUID()}.tmp`
      );
      try {
        await writeFile(temporaryPath, input.content, {
          encoding: "utf8",
          flag: "wx"
        });
        if (!input.force) {
          await this.assertNoSymlinkTraversal(absolute);
          const latestInfo = await stat(absolute);
          if (Math.abs(latestInfo.mtimeMs - currentInfo.mtimeMs) > 0.5 || latestInfo.size !== currentInfo.size) {
            const currentContent = await readFile(absolute, "utf8");
            throw new VaultError({
              code: "FILE_CHANGED",
              message: "\u4FDD\u5B58\u4E2D\u306B\u3001\u3053\u306E\u30CE\u30FC\u30C8\u304C\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002",
              currentContent,
              currentModifiedAt: latestInfo.mtimeMs
            });
          }
          if (input.expectedContent !== void 0) {
            const latestContent = await readFile(absolute, "utf8");
            if (latestContent !== input.expectedContent) {
              throw new VaultError({
                code: "FILE_CHANGED",
                message: "\u4FDD\u5B58\u4E2D\u306B\u3001\u3053\u306E\u30CE\u30FC\u30C8\u304C\u5225\u306E\u30A2\u30D7\u30EA\u3067\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002",
                currentContent: latestContent,
                currentModifiedAt: latestInfo.mtimeMs
              });
            }
          }
        }
        await rename(temporaryPath, absolute);
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => void 0);
        throw error;
      }
      const savedInfo = await stat(absolute);
      return {
        path: input.path,
        modifiedAt: savedInfo.mtimeMs,
        size: savedInfo.size
      };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      throw fromNodeError(error, "SAVE_FAILED", "\u30CE\u30FC\u30C8\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async createNote(input) {
    const name = withMarkdownExtension(input.name.trim());
    const nameValidation = validateEntryName(name);
    if (!nameValidation.valid) {
      throw new VaultError({
        code: "INVALID_NAME",
        message: nameValidation.reason ?? "\u30CE\u30FC\u30C8\u540D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    const directory = this.absolutePath(input.directory, true);
    const destination = join(directory, name);
    try {
      await this.assertNoSymlinkTraversal(directory);
      const parentInfo = await stat(directory);
      if (!parentInfo.isDirectory()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u4F5C\u6210\u5148\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002"
        });
      }
      await writeFile(destination, input.content ?? "", {
        encoding: "utf8",
        flag: "wx"
      });
      return { path: this.relativePath(destination) };
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u30CE\u30FC\u30C8\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async importAttachments(sourcePaths, destinationDirectory) {
    const directory = this.absolutePath(destinationDirectory, true);
    await this.assertNoSymlinkTraversal(directory);
    const directoryInfo = await stat(directory);
    if (!directoryInfo.isDirectory()) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u306E\u4FDD\u5B58\u5148\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002"
      });
    }
    const imported = [];
    for (const sourcePath of sourcePaths) {
      const sourceInfo = await lstat(sourcePath);
      if (sourceInfo.isSymbolicLink() || !sourceInfo.isFile()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u901A\u5E38\u306E\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u6DFB\u4ED8\u3067\u304D\u307E\u3059\u3002"
        });
      }
      const fileName = basename(sourcePath);
      if (!isSupportedAttachmentPath(fileName)) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u5BFE\u5FDC\u3059\u308B\u753B\u50CF\u3001PDF\u3001\u97F3\u58F0\u3001\u52D5\u753B\u3060\u3051\u3092\u6DFB\u4ED8\u3067\u304D\u307E\u3059\u3002"
        });
      }
      const destination = await this.findAvailableMoveDestination(
        sourcePath,
        join(directory, fileName)
      );
      const temporaryPath = join(
        directory,
        `.tsuzune-${fileName}-${randomUUID()}.tmp`
      );
      try {
        await copyFile(sourcePath, temporaryPath, fsConstants.COPYFILE_EXCL);
        await copyFile(temporaryPath, destination, fsConstants.COPYFILE_EXCL);
      } catch (error) {
        throw fromNodeError(error, "UNKNOWN", "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      } finally {
        await rm(temporaryPath, { force: true }).catch(() => void 0);
      }
      imported.push({ path: this.relativePath(destination) });
    }
    return imported;
  }
  async createDirectory(input) {
    const name = input.name.trim();
    const nameValidation = validateEntryName(name);
    if (!nameValidation.valid) {
      throw new VaultError({
        code: "INVALID_NAME",
        message: nameValidation.reason ?? "\u30D5\u30A9\u30EB\u30C0\u540D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    const parent = this.absolutePath(input.parent, true);
    const destination = join(parent, name);
    try {
      await this.assertNoSymlinkTraversal(parent);
      await mkdir(destination);
      return { path: this.relativePath(destination) };
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u30D5\u30A9\u30EB\u30C0\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async renameEntry(input) {
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const source = this.absolutePath(input.path);
    if (isAuditHistoryPath(input.path)) {
      throw new VaultError({
        code: "ACCESS_DENIED",
        message: "\u76E3\u67FB\u5C65\u6B74\u306F\u540D\u524D\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    let info;
    try {
      await this.assertNoSymlinkTraversal(source);
      info = await lstat(source);
    } catch (error) {
      throw fromNodeError(error, "NOT_FOUND", "\u540D\u524D\u3092\u5909\u66F4\u3059\u308B\u5BFE\u8C61\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002");
    }
    if (info.isSymbolicLink()) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "\u30B7\u30F3\u30DC\u30EA\u30C3\u30AF\u30EA\u30F3\u30AF\u306F\u64CD\u4F5C\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    let newName = input.newName.trim();
    if (info.isFile() && isMarkdownFile(input.path)) {
      newName = withMarkdownExtension(newName);
    }
    const nameValidation = validateEntryName(newName);
    if (!nameValidation.valid) {
      throw new VaultError({
        code: "INVALID_NAME",
        message: nameValidation.reason ?? "\u65B0\u3057\u3044\u540D\u524D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    const destination = join(dirname(source), newName);
    if (isAuditHistoryPath(this.relativePathFrom(root, destination))) {
      throw new VaultError({
        code: "ACCESS_DENIED",
        message: "\u76E3\u67FB\u5C65\u6B74\u306E\u9818\u57DF\u3078\u540D\u524D\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    try {
      await this.ensureDestinationAvailable(source, destination);
      await rename(source, destination);
      const oldPath = this.relativePathFrom(root, source);
      const newPath = this.relativePathFrom(root, destination);
      await this.moveCreationTimes(
        root,
        revision,
        oldPath,
        newPath,
        info.isDirectory()
      );
      return {
        oldPath,
        path: newPath
      };
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u540D\u524D\u3092\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async moveNote(input) {
    if (!isMarkdownFile(input.path) && !isSupportedAttachmentPath(input.path)) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Markdown\u30CE\u30FC\u30C8\u307E\u305F\u306F\u5BFE\u5FDC\u3059\u308B\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u79FB\u52D5\u3067\u304D\u307E\u3059\u3002"
      });
    }
    return this.moveEntry(input);
  }
  async resolveMoveDestination(input) {
    const source = this.absolutePath(input.path);
    const destinationDirectory = input.destinationPath ? this.absolutePath(dirnameRelative(input.destinationPath), true) : this.absolutePath(input.destinationDirectory, true);
    const requestedDestination = input.destinationPath ? this.absolutePath(input.destinationPath) : join(destinationDirectory, basename(source));
    const destination = input.destinationPath ? requestedDestination : await this.findAvailableMoveDestination(source, requestedDestination);
    return this.relativePath(destination);
  }
  async moveEntry(input) {
    if (!input.path || input.path === ".trash" || input.path.startsWith(".trash/") || input.path === ".tsuzune" || input.path.startsWith(".tsuzune/")) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: "Vault\u672C\u4F53\u307E\u305F\u306FTSUZUNE\u306E\u5185\u90E8\u7BA1\u7406\u9805\u76EE\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    const root = this.requireRoot();
    if (isAuditHistoryPath(input.path)) {
      throw new VaultError({
        code: "ACCESS_DENIED",
        message: "\u76E3\u67FB\u5C65\u6B74\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    const revision = this.rootRevision;
    const source = this.absolutePath(input.path);
    const destinationDirectory = input.destinationPath ? this.absolutePath(dirnameRelative(input.destinationPath), true) : this.absolutePath(input.destinationDirectory, true);
    const requestedDestination = input.destinationPath ? this.absolutePath(input.destinationPath) : join(destinationDirectory, basename(source));
    try {
      await this.assertNoSymlinkTraversal(source);
      await this.assertNoSymlinkTraversal(destinationDirectory);
      const sourceInfo = await lstat(source);
      if (sourceInfo.isSymbolicLink()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u30B7\u30F3\u30DC\u30EA\u30C3\u30AF\u30EA\u30F3\u30AF\u306F\u64CD\u4F5C\u3067\u304D\u307E\u305B\u3093\u3002"
        });
      }
      if (!sourceInfo.isDirectory() && !isMarkdownFile(input.path) && !isSupportedAttachmentPath(input.path)) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u30D5\u30A9\u30EB\u30C0\u3001Markdown\u30CE\u30FC\u30C8\u3001\u5BFE\u5FDC\u3059\u308B\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3060\u3051\u3092\u79FB\u52D5\u3067\u304D\u307E\u3059\u3002"
        });
      }
      const sourcePath = this.relativePathFrom(root, source);
      const destinationDirectoryPath = this.relativePathFrom(
        root,
        destinationDirectory
      );
      if (sourceInfo.isDirectory() && isPathInsideOrEqual(destinationDirectoryPath, sourcePath)) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u30D5\u30A9\u30EB\u30C0\u3092\u81EA\u5206\u81EA\u8EAB\u306E\u4E2D\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3002"
        });
      }
      const directoryInfo = await stat(destinationDirectory);
      if (!directoryInfo.isDirectory()) {
        throw new VaultError({
          code: "INVALID_PATH",
          message: "\u79FB\u52D5\u5148\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002"
        });
      }
      const destination = input.destinationPath ? requestedDestination : await this.findAvailableMoveDestination(
        source,
        requestedDestination
      );
      if (isAuditHistoryPath(this.relativePathFrom(root, destination))) {
        throw new VaultError({
          code: "ACCESS_DENIED",
          message: "\u76E3\u67FB\u5C65\u6B74\u306E\u9818\u57DF\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3002"
        });
      }
      await this.ensureDestinationAvailable(source, destination);
      await rename(source, destination);
      const oldPath = this.relativePathFrom(root, source);
      const newPath = this.relativePathFrom(root, destination);
      await this.moveCreationTimes(
        root,
        revision,
        oldPath,
        newPath,
        sourceInfo.isDirectory()
      );
      return {
        oldPath,
        path: newPath
      };
    } catch (error) {
      throw fromNodeError(error, "UNKNOWN", "\u9805\u76EE\u3092\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  async trashEntry(relativePath, beforeRename) {
    if (relativePath === ".trash" || relativePath.startsWith(".trash/")) {
      throw new VaultError({
        code: "INVALID_PATH",
        message: ".trash\u306FTSUZUNE\u304B\u3089\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    if (isAuditHistoryPath(relativePath)) {
      throw new VaultError({
        code: "ACCESS_DENIED",
        message: "\u76E3\u67FB\u5C65\u6B74\u306F\u3054\u307F\u7BB1\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3002"
      });
    }
    const root = this.requireRoot();
    const revision = this.rootRevision;
    const source = this.absolutePath(relativePath);
    const normalizedPath = this.relativePathFrom(root, source);
    const trashRoot = join(root, ".trash");
    const batchRoot = join(trashRoot, `${timestampSuffix()}-${randomUUID()}`);
    const destination = join(batchRoot, ...relativePath.split("/"));
    let batchCreated = false;
    let preconditionError;
    try {
      await this.assertNoSymlinkTraversal(source);
      await this.assertNoSymlinkTraversal(trashRoot, true);
      await mkdir(trashRoot, { recursive: true });
      await this.assertNoSymlinkTraversal(trashRoot);
      await this.assertNoSymlinkTraversal(dirname(destination), true);
      await mkdir(batchRoot);
      batchCreated = true;
      await mkdir(dirname(destination), { recursive: true });
      await this.assertNoSymlinkTraversal(dirname(destination));
      try {
        await beforeRename?.();
      } catch (error) {
        preconditionError = error;
        throw error;
      }
      await rename(source, destination);
      await this.removeCreationTimes(root, revision, normalizedPath);
      return {
        oldPath: normalizedPath,
        path: this.relativePathFrom(root, destination)
      };
    } catch (error) {
      if (batchCreated) {
        await rm(batchRoot, { recursive: true, force: true }).catch(() => void 0);
      }
      if (preconditionError) {
        throw preconditionError;
      }
      throw fromNodeError(error, "UNKNOWN", ".trash\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
    }
  }
  buildPathAfterRename(relativePath, newName) {
    const currentName = basenameRelative(relativePath);
    const extension = isMarkdownFile(currentName) ? ".md" : "";
    const normalizedName = extension && !newName.toLocaleLowerCase().endsWith(extension) ? `${newName}${extension}` : newName;
    return joinRelative(dirnameRelative(relativePath), normalizedName);
  }
  resolveMarkdownRenameDestination(input) {
    const newName = withMarkdownExtension(input.newName.trim());
    const validation = validateEntryName(newName);
    if (!validation.valid) {
      throw new VaultError({
        code: "INVALID_NAME",
        message: validation.reason ?? "\u65B0\u3057\u3044\u540D\u524D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    return joinRelative(dirnameRelative(input.path), newName);
  }
};

// scripts/generate-life-weather-prototype.ts
var round2 = (value) => Math.round(value * 1e6) / 1e6;
var opaqueId = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
function foldContent(features) {
  const folded = Array(12).fill(0);
  features.forEach((value, index) => {
    folded[index % folded.length] += value;
  });
  const magnitude = Math.hypot(...folded);
  return magnitude === 0 ? folded : folded.map((value) => round2(value / magnitude));
}
function serializeProfile(profile, indexByPath) {
  const serializeCandidate = (candidate) => ({
    id: candidate.id,
    kind: candidate.kind,
    sourceIndices: candidate.sourceNoteIds.map((path) => indexByPath.get(path)).filter((index) => index !== void 0),
    evidence: candidate.evidence
  });
  const phenomena = Object.fromEntries(Object.entries(profile.phenomena).map(([kind, candidates]) => [
    kind,
    candidates.map(serializeCandidate)
  ]));
  const value = {
    version: profile.version,
    source: profile.source,
    strata: profile.strata.map((stratum) => ({
      index: stratum.index,
      start: stratum.start,
      end: stratum.end,
      sourceIndices: stratum.sourceNoteIds.map((path) => indexByPath.get(path)).filter((index) => index !== void 0),
      activityDensity: stratum.activityDensity,
      contentNovelty: stratum.contentNovelty
    })),
    phenomena,
    omittedPhenomenonCounts: profile.omittedPhenomenonCounts
  };
  return {
    ...value,
    fingerprint: createHash("sha256").update(JSON.stringify(value)).digest("hex")
  };
}
function buildParticles(observations) {
  const timed = observations.map((entry) => entry.observedAt).filter((value) => value !== null);
  const start = Math.min(...timed);
  const span = Math.max(1, Math.max(...timed) - start);
  const maxCharacters = Math.max(1, ...observations.map((entry) => Math.log1p(entry.structureFeatures.characterCount)));
  const maxHeadings = Math.max(1, ...observations.map((entry) => entry.structureFeatures.headingCount));
  const maxLinks = Math.max(1, ...observations.map((entry) => entry.structureFeatures.outboundLinkCount));
  const indexByPath = new Map(observations.map((entry, index) => [entry.sourceNoteId, index]));
  return observations.map((entry) => {
    const time = entry.observedAt === null ? 0.5 : (entry.observedAt - start) / span;
    const characters = Math.log1p(entry.structureFeatures.characterCount) / maxCharacters;
    const headings = entry.structureFeatures.headingCount / maxHeadings;
    const links = entry.structureFeatures.outboundLinkCount / maxLinks;
    return {
      id: opaqueId(entry.sourceNoteId),
      label: entry.sourceNoteId.replace(/\\/g, "/").split("/").at(-1)?.replace(/\.md/gi, "") ?? "\u540D\u79F0\u672A\u53D6\u5F97",
      content: foldContent(entry.contentFeatures),
      time: [round2(time), round2(Math.sin(time * Math.PI * 2)), round2(Math.cos(time * Math.PI * 2))],
      structure: [
        round2(characters),
        round2(headings),
        round2(links),
        round2(headings / Math.max(characters, 0.01)),
        round2(links / Math.max(characters, 0.01)),
        entry.observedAt === null ? 0 : 1
      ],
      phase: LIFE_WEATHER_PHASE_AXES.map((axis) => round2(entry.phaseFeatures[axis])),
      links: entry.linkTargets.map((path) => indexByPath.get(path)).filter((index) => index !== void 0)
    };
  });
}
async function main() {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is unavailable");
  const settings = JSON.parse(await readFile2(join2(appData, "TSUZUNE", "settings.json"), "utf8"));
  if (typeof settings.lastVaultPath !== "string") throw new Error("TSUZUNE has no active Vault");
  const vault = new VaultService();
  await vault.setRootPath(settings.lastVaultPath);
  const scanned = await vault.scan(parseUserIgnoreFilters(settings.userIgnoreFilters));
  const excluded = createExcludedFileMatcher(["50_\u5C65\u6B74"]);
  const notes = scanned.notes.filter((note) => !excluded(note.path));
  const graph = buildWikiGraph(notes);
  const observations = createLifeWeatherObservations(notes, graph);
  const indexByPath = new Map(observations.map((entry, index) => [entry.sourceNoteId, index]));
  const particles = buildParticles(observations);
  const baseline = serializeProfile(createLifeWeatherProfile(observations), indexByPath);
  const controls = {
    timeShuffled: serializeProfile(createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, "time", "gate-2-time")), indexByPath),
    contentShuffled: serializeProfile(createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, "content", "gate-2-content")), indexByPath),
    linksRemoved: serializeProfile(createLifeWeatherProfile(withoutLifeWeatherLinks(observations)), indexByPath)
  };
  const resolvedLinks = particles.reduce((sum, particle) => sum + particle.links.length, 0);
  const snapshotCore = {
    schema: "tsuzune-note-particles/v3",
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "active TSUZUNE Vault excluding protected history",
    exclusions: ["50_\u5C65\u6B74", ...parseUserIgnoreFilters(settings.userIgnoreFilters)],
    noteCount: particles.length,
    trackDimensions: {
      content: 12,
      time: 3,
      structure: 6,
      phase: LIFE_WEATHER_PHASE_AXES,
      links: "resolved note indices"
    },
    linkResolution: { resolved: resolvedLinks },
    notes: particles,
    lifeWeather: baseline
  };
  const snapshot = {
    ...snapshotCore,
    fingerprint: createHash("sha256").update(JSON.stringify(snapshotCore)).digest("hex")
  };
  const output = `// Generated from the active Vault. Contains opaque note identifiers and numeric observations only.
export const noteSnapshot = Object.freeze(${JSON.stringify(snapshot, null, 2)})

export const lifeWeatherControls = Object.freeze(${JSON.stringify(controls, null, 2)})
`;
  const outputPath = join2(process.cwd(), "work", "archive-weather-prototype", "note-snapshot.mjs");
  await writeFile2(outputPath, output, "utf8");
  console.log(JSON.stringify({ outputPath, noteCount: particles.length, fingerprint: snapshot.fingerprint }, null, 2));
}
await main();
