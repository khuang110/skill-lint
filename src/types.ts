export type Severity = "error" | "warning";

export interface Finding {
  ruleId: string;
  severity: Severity;
  /** Path relative to the scan root. */
  file: string;
  /** 1-based line number, or 1 when not line-specific. */
  line: number;
  message: string;
}

export interface SkillFile {
  /** Path of SKILL.md relative to the scan root. */
  path: string;
  /** Absolute path of SKILL.md. */
  absolutePath: string;
  /** Absolute path of the skill directory (parent of SKILL.md). */
  bundleRoot: string;
  /** Absolute path of the scan root. */
  scanRoot: string;
  /** Raw SKILL.md contents. */
  content: string;
  /** Parsed frontmatter, or null when absent or malformed. */
  frontmatter: Record<string, unknown> | null;
  /** 1-based line where the markdown body starts (after frontmatter). */
  bodyStartLine: number;
}

export interface Rule {
  id: string;
  description: string;
  run(skill: SkillFile, allSkills?: SkillFile[]): Finding[];
}
