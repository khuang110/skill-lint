import { basename } from "node:path";
import type { Finding, Rule, SkillFile } from "../types.js";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_COMPATIBILITY = 500;

function lineOf(content: string, needle: string): number {
  const idx = content.indexOf(needle);
  return idx === -1 ? 1 : content.slice(0, idx).split("\n").length;
}

function find(skill: SkillFile, ruleId: string, message: string, line = 1): Finding {
  return { ruleId, severity: "error", file: skill.path, line, message };
}

export const frontmatterRule: Rule = {
  id: "metadata",
  description: "SKILL.md must have valid frontmatter with name and description.",
  run(skill: SkillFile): Finding[] {
    const findings: Finding[] = [];

    if (skill.frontmatter === null) {
      findings.push(
        find(
          skill,
          "metadata/missing-frontmatter",
          "SKILL.md has no valid YAML frontmatter. Add a `---` block with `name` and `description`.",
        ),
      );
      return findings;
    }

    const fm = skill.frontmatter;

    const name = fm.name;
    if (typeof name !== "string" || name.length === 0) {
      findings.push(
        find(
          skill,
          "metadata/name-required",
          "Frontmatter is missing the required `name` field.",
          lineOf(skill.content, "name:"),
        ),
      );
    } else {
      if (name.length > MAX_NAME) {
        findings.push(
          find(
            skill,
            "metadata/name-length",
            `name is ${name.length} characters (max ${MAX_NAME}).`,
            lineOf(skill.content, "name:"),
          ),
        );
      }
      if (!NAME_RE.test(name)) {
        findings.push(
          find(
            skill,
            "metadata/name-format",
            "name must use lowercase letters, numbers, and single hyphens (no leading/trailing/consecutive hyphens).",
            lineOf(skill.content, "name:"),
          ),
        );
      }
      const dir = basename(skill.bundleRoot);
      if (name !== dir) {
        findings.push(
          find(
            skill,
            "metadata/name-matches-directory",
            `name "${name}" must match the skill directory name "${dir}".`,
            lineOf(skill.content, "name:"),
          ),
        );
      }
    }

    const description = fm.description;
    if (typeof description !== "string" || description.length === 0) {
      findings.push(
        find(
          skill,
          "metadata/description-required",
          "Frontmatter is missing the required `description` field.",
          lineOf(skill.content, "description:"),
        ),
      );
    } else if (description.length > MAX_DESCRIPTION) {
      findings.push(
        find(
          skill,
          "metadata/description-length",
          `description is ${description.length} characters (max ${MAX_DESCRIPTION}).`,
          lineOf(skill.content, "description:"),
        ),
      );
    }

    if (
      fm.compatibility !== undefined &&
      (typeof fm.compatibility !== "string" ||
        fm.compatibility.length > MAX_COMPATIBILITY)
    ) {
      findings.push(
        find(
          skill,
          "metadata/compatibility-length",
          `compatibility must be a string of at most ${MAX_COMPATIBILITY} characters.`,
          lineOf(skill.content, "compatibility:"),
        ),
      );
    }

    if (fm.metadata !== undefined) {
      if (fm.metadata === null || typeof fm.metadata !== "object" || Array.isArray(fm.metadata)) {
        findings.push(
          find(
            skill,
            "metadata/metadata-string-values",
            "metadata must be a map of string values.",
            lineOf(skill.content, "metadata:"),
          ),
        );
      } else {
        for (const [k, v] of Object.entries(fm.metadata as Record<string, unknown>)) {
          if (typeof v !== "string") {
            findings.push(
              find(
                skill,
                "metadata/metadata-string-values",
                `metadata key "${k}" must be a string value.`,
                lineOf(skill.content, k),
              ),
            );
          }
        }
      }
    }

    return findings;
  },
};
