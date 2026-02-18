import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const IGNORE_LINE_MARKER = "mobile-check-ignore";

const findings = [];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) continue;
    await checkFile(fullPath);
  }
}

function isResponsivePrefixed(line, tokenIndex) {
  const prevChar = line[tokenIndex - 1];
  return prevChar === ":";
}

function hasClassPrefix(line, tokenIndex, prefix) {
  if (tokenIndex < prefix.length) return false;
  return line.slice(tokenIndex - prefix.length, tokenIndex) === prefix;
}

function pushFinding(filePath, lineNo, rule, token, lineText) {
  findings.push({
    filePath,
    lineNo,
    rule,
    token,
    lineText: lineText.trim(),
  });
}

async function checkFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const relativePath = path.relative(ROOT, filePath);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (line.includes(IGNORE_LINE_MARKER)) return;

    if (line.includes("min-w-max")) {
      pushFinding(relativePath, lineNo, "min-w-max 사용 금지", "min-w-max", line);
    }

    const minWidthRegex = /min-w-\[(\d+)px\]/g;
    for (const match of line.matchAll(minWidthRegex)) {
      const token = match[0];
      const value = Number.parseInt(match[1], 10);
      const tokenIndex = match.index ?? -1;
      if (isResponsivePrefixed(line, tokenIndex)) continue;
      if (value >= 320) {
        pushFinding(
          relativePath,
          lineNo,
          "모바일에서 과도한 고정 min-width",
          token,
          line
        );
      }
    }

    const gridRegex = /grid-cols-\[([^\]]+)\]/g;
    for (const match of line.matchAll(gridRegex)) {
      const token = match[0];
      const tokenIndex = match.index ?? -1;
      if (isResponsivePrefixed(line, tokenIndex)) continue;

      const pxValues = [...match[1].matchAll(/(\d+)px/g)].map((m) =>
        Number.parseInt(m[1], 10)
      );
      const maxPx = pxValues.length > 0 ? Math.max(...pxValues) : 0;
      if (maxPx >= 120) {
        pushFinding(
          relativePath,
          lineNo,
          "breakpoint 없는 고정 grid column",
          token,
          line
        );
      }
    }

    const widthRegex = /w-\[(\d+)px\]/g;
    for (const match of line.matchAll(widthRegex)) {
      const token = match[0];
      const value = Number.parseInt(match[1], 10);
      const tokenIndex = match.index ?? -1;
      if (isResponsivePrefixed(line, tokenIndex)) continue;
      if (hasClassPrefix(line, tokenIndex, "min-")) continue;
      if (hasClassPrefix(line, tokenIndex, "max-")) continue;
      if (value >= 280) {
        pushFinding(
          relativePath,
          lineNo,
          "모바일에서 과도한 고정 width",
          token,
          line
        );
      }
    }

    const marginLeftRegex = /ml-\[(\d+)px\]/g;
    for (const match of line.matchAll(marginLeftRegex)) {
      const token = match[0];
      const value = Number.parseInt(match[1], 10);
      const tokenIndex = match.index ?? -1;
      if (isResponsivePrefixed(line, tokenIndex)) continue;
      if (value >= 80) {
        pushFinding(
          relativePath,
          lineNo,
          "breakpoint 없는 고정 좌측 margin",
          token,
          line
        );
      }
    }
  });
}

async function main() {
  await walk(SRC_DIR);

  if (findings.length === 0) {
    console.log("mobile overflow check passed");
    return;
  }

  console.error("mobile overflow check failed:");
  for (const finding of findings) {
    console.error(
      `- ${finding.filePath}:${finding.lineNo} [${finding.rule}] ${finding.token}\n  ${finding.lineText}`
    );
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("mobile overflow check error:", error);
  process.exitCode = 1;
});
