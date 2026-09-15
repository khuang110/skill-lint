import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Finding, SkillFile } from "./types.js";

interface LinkRef {
  target: string;
  line: number;
}

const INLINE_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const REF_DEF = /^\s*\[([^\]]+)\]:\s*(\S+)\s*$/;
const REF_USE = /\[[^\]]*\]\[([^\]]+)\]/g;

function isExternal(target: string): boolean {
  return /^(https?:|mailto:|#)/i.test(target);
}

/** Template placeholders that are not real file references. */
function isPlaceholder(target: string): boolean {
  const t = target.trim();
  return (
    t === "URL" ||
    /^<[^>]+>$/.test(t) ||
    /^[A-Za-z0-9_-]+\/\/$/.test(t) ||
    t === "..."
  );
}

function parseLinks(content: string): LinkRef[] {
  const links: LinkRef[] = [];
  const lines = content.split("\n");

  const defs = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const m = REF_DEF.exec(lines[i]);
    if (m) defs.set(m[1].toLowerCase(), m[2]);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(INLINE_LINK)) {
      links.push({ target: m[1], line: i + 1 });
    }
    for (const m of line.matchAll(REF_USE)) {
      const target = defs.get(m[1].toLowerCase());
      if (target) links.push({ target, line: i + 1 });
    }
  }
  return links;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

export interface ReferenceOptions {
  /** Suppress cross-skill warnings (monorepo skill catalogs). */
  catalog?: boolean;
}

/**
 * Check local references inside a skill bundle. Follows linked Markdown
 * files, but never reads outside the bundle.
 *
 * A link that escapes the bundle lexically is classified as:
 *   - `references/missing` (error) when the target does not exist anywhere;
 *   - `references/cross-skill` (warning) when it resolves to a real file
 *     elsewhere in the repository (a legitimate sibling-skill reference);
 *   - suppressed entirely in `catalog` mode.
 *
 * Symlinked targets are resolved and rejected when their real location
 * escapes the bundle. Each finding names the file that contains the broken
 * link and shows the reference chain.
 */
export async function checkReferences(
  skill: SkillFile,
  options: ReferenceOptions = {},
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const visited = new Set<string>();

  let bundleReal: string;
  try {
    bundleReal = await realpath(skill.bundleRoot);
  } catch {
    bundleReal = skill.bundleRoot;
  }

  /**
   * Classify a link that resolves (lexically) outside the bundle.
   * Returns a Finding, or null when it should be suppressed (catalog mode +
   * existing cross-skill target).
   */
  async function classifyOutside(
    targetRel: string,
    file: string,
    line: number,
    chain: string[],
  ): Promise<Finding | null> {
    // targetRel is relative to the bundle root (the literal link path).
    const abs = resolve(skill.bundleRoot, targetRel);
    let real: string | null = null;
    try {
      real = await realpath(abs);
    } catch {
      real = null;
    }
    const existsInRepo = real !== null && isInside(skill.scanRoot, real);
    if (!existsInRepo) {
      return {
        ruleId: "references/missing",
        severity: "error",
        file,
        line,
        message: `Linked file does not exist: ${targetRel}. Referenced through: ${chain.join(" -> ")}.`,
      };
    }
    if (options.catalog) return null;
    return {
      ruleId: "references/cross-skill",
      severity: "warning",
      file,
      line,
      message: `Link "${targetRel}" points to another skill outside the bundle. Referenced through: ${chain.join(" -> ")}.`,
    };
  }

  async function walk(relPath: string, chain: string[]): Promise<void> {
    const abs = resolve(skill.bundleRoot, relPath);
    if (!isInside(bundleReal, abs)) {
      const f = await classifyOutside(relPath, relPath, 1, chain);
      if (f) findings.push(f);
      return;
    }

    // Resolve symlinks and require the real target to remain inside the bundle.
    let real: string;
    try {
      real = await realpath(abs);
    } catch {
      findings.push({
        ruleId: "references/missing",
        severity: "error",
        file: relPath,
        line: 1,
        message: `Linked file does not exist: ${relPath}. Referenced through: ${chain.join(" -> ")}.`,
      });
      return;
    }
    if (!isInside(bundleReal, real)) {
      const f = await classifyOutside(relPath, relPath, 1, chain);
      if (f) findings.push(f);
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);

    let content: string;
    try {
      const st = await stat(real);
      // A link to a directory is a valid reference; we only follow .md files.
      if (st.isDirectory()) return;
      if (!st.isFile()) {
        findings.push({
          ruleId: "references/missing",
          severity: "error",
          file: relPath,
          line: 1,
          message: `Linked target is not a file or directory: ${relPath}. Referenced through: ${chain.join(" -> ")}.`,
        });
        return;
      }
      content = await readFile(real, "utf8");
    } catch {
      findings.push({
        ruleId: "references/missing",
        severity: "error",
        file: relPath,
        line: 1,
        message: `Linked file could not be read: ${relPath}. Referenced through: ${chain.join(" -> ")}.`,
      });
      return;
    }

    if (!/\.md$/i.test(relPath)) return;

    for (const link of parseLinks(content)) {
      if (isExternal(link.target)) continue;
      if (isPlaceholder(link.target)) continue;
      // Heading anchors are out of scope: strip the fragment and only check
      // that the referenced file exists.
      const fragmentIdx = link.target.indexOf("#");
      const rawTarget =
        fragmentIdx === -1 ? link.target : link.target.slice(0, fragmentIdx);
      if (rawTarget === "") continue; // same-file anchor only
      // Decode percent-encoded link targets (e.g. "my%20file.md").
      let pathTarget: string;
      try {
        pathTarget = decodeURIComponent(rawTarget);
      } catch {
        pathTarget = rawTarget;
      }
      if (isAbsolute(pathTarget)) {
        findings.push({
          ruleId: "references/absolute",
          severity: "warning",
          file: relPath,
          line: link.line,
          message: `Link "${pathTarget}" is absolute. Use a path relative to the skill directory.`,
        });
        continue;
      }
      const targetRel = join(dirname(relPath), pathTarget);
      const targetAbs = resolve(skill.bundleRoot, targetRel);

      // A link that escapes the bundle lexically is classified as missing or
      // cross-skill (never followed).
      if (!isInside(skill.bundleRoot, targetAbs)) {
        const f = await classifyOutside(targetRel, relPath, link.line, chain);
        if (f) findings.push(f);
        continue;
      }

      let targetReal: string | null = null;
      try {
        targetReal = await realpath(targetAbs);
      } catch {
        targetReal = null;
      }
      if (targetReal === null) {
        findings.push({
          ruleId: "references/missing",
          severity: "error",
          file: relPath,
          line: link.line,
          message: `Linked file does not exist: ${targetRel}. Referenced through: ${chain.join(" -> ")}.`,
        });
        continue;
      }
      if (!isInside(bundleReal, targetReal)) {
        const f = await classifyOutside(targetRel, relPath, link.line, chain);
        if (f) findings.push(f);
        continue;
      }
      await walk(targetRel, [...chain, targetRel]);
    }
  }

  await walk("SKILL.md", ["SKILL.md"]);
  return findings;
}
