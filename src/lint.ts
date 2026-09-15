import type { Finding, SkillFile } from "./types.js";
import { rules } from "./rules/index.js";
import { checkReferences } from "./references.js";

export interface SizeReport {
  path: string;
  lines: number;
  bytes: number;
}

export interface LintResult {
  skills: SkillFile[];
  findings: Finding[];
  sizes: SizeReport[];
}

function sizeOf(skill: SkillFile): SizeReport {
  return {
    path: skill.path,
    lines: skill.content.split("\n").length,
    bytes: Buffer.byteLength(skill.content, "utf8"),
  };
}

/** Run all checks against every skill. */
export async function lintSkills(skills: SkillFile[]): Promise<LintResult> {
  const findings: Finding[] = [];
  for (const skill of skills) {
    for (const rule of rules) {
      findings.push(...rule.run(skill, skills));
    }
    findings.push(...(await checkReferences(skill)));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const sizes = skills.map(sizeOf);
  return { skills, findings, sizes };
}

export function countBySeverity(findings: Finding[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const f of findings) {
    if (f.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}
