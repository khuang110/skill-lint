import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep, dirname } from "node:path";
import { parseFrontmatter } from "./frontmatter.js";
import type { SkillFile } from "./types.js";

export interface DiscoveryIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface DiscoveryResult {
  skills: SkillFile[];
  issues: DiscoveryIssue[];
}

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".venv",
  "venv",
  "__pycache__",
]);

/** Absolute scan root, resolved and deduplicated. */
async function resolveRoot(input: string): Promise<string> {
  const abs = resolve(input);
  try {
    return await realpath(abs);
  } catch {
    return abs;
  }
}

/**
 * Discover SKILL.md files under an absolute root. Returns skills and any
 * non-fatal issues encountered (unreadable dirs, unsafe symlinks).
 */
export async function discover(root: string): Promise<DiscoveryResult> {
  const skills: SkillFile[] = [];
  const issues: DiscoveryIssue[] = [];
  const seen = new Set<string>();

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      issues.push({
        severity: "warning",
        path: relative(root, dir) || ".",
        message: `Could not read directory: ${(err as Error).message}`,
      });
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
        await addSkill(full);
      }
    }
  }

  async function addSkill(file: string): Promise<void> {
    let real: string;
    try {
      real = await realpath(file);
    } catch {
      issues.push({
        severity: "warning",
        path: relative(root, file),
        message: "Could not resolve SKILL.md path.",
      });
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    if (!isInside(root, real)) {
      issues.push({
        severity: "warning",
        path: relative(root, file),
        message: "SKILL.md resolves outside the scan root; skipped.",
      });
      return;
    }
    let content: string;
    try {
      content = await readFile(real, "utf8");
    } catch (err) {
      issues.push({
        severity: "error",
        path: relative(root, file),
        message: `Could not read SKILL.md: ${(err as Error).message}`,
      });
      return;
    }
    const { frontmatter, bodyStartLine } = parseFrontmatter(content);
    skills.push({
      path: relative(root, real),
      absolutePath: real,
      bundleRoot: dirname(real),
      scanRoot: root,
      content,
      frontmatter,
      bodyStartLine,
    });
  }

  const rootStat = await stat(root).catch(() => null);
  if (rootStat?.isFile()) {
    await addSkill(root);
  } else {
    await walk(root);
  }

  skills.sort((a, b) => a.path.localeCompare(b.path));
  return { skills, issues };
}

export async function loadSkills(input: string): Promise<DiscoveryResult> {
  const abs = resolve(input);
  const st = await stat(abs).catch(() => null);
  // An explicit SKILL.md path scans its containing skill directory.
  const root = await resolveRoot(st?.isFile() ? dirname(abs) : abs);
  return discover(root);
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith(".." + sep) && rel !== "..";
}
