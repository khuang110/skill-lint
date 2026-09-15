import { basename } from "node:path";
import type { Finding, Rule, SkillFile } from "../types.js";

const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_COMPATIBILITY = 500;

/** Unicode letters and numbers plus hyphens, matching the reference validator. */
const NAME_CHAR_RE = /^[\p{L}\p{N}-]+$/u;

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
    if (typeof name !== "string" || name.trim().length === 0) {
      findings.push(
        find(
          skill,
          "metadata/name-required",
          "Frontmatter is missing the required `name` field.",
          lineOf(skill.content, "name:"),
        ),
      );
    } else {
      // Mirror the reference validator: NFKC-normalize and strip, then apply
      // the same character/length/case/hyphen rules (Unicode letters allowed).
      const normalized = name.normalize("NFKC").trim();
      if (normalized.length > MAX_NAME) {
        findings.push(
          find(
            skill,
            "metadata/name-length",
            `name is ${normalized.length} characters (max ${MAX_NAME}).`,
            lineOf(skill.content, "name:"),
          ),
        );
      }
      if (normalized !== normalized.toLowerCase()) {
        findings.push(
          find(
            skill,
            "metadata/name-format",
            "name must be lowercase.",
            lineOf(skill.content, "name:"),
          ),
        );
      }
      if (normalized.startsWith("-") || normalized.endsWith("-")) {
        findings.push(
          find(
            skill,
            "metadata/name-format",
            "name cannot start or end with a hyphen.",
            lineOf(skill.content, "name:"),
          ),
        );
      }
      if (normalized.includes("--")) {
        findings.push(
          find(
            skill,
            "metadata/name-format",
            "name cannot contain consecutive hyphens.",
            lineOf(skill.content, "name:"),
          ),
        );
      }
      if (!NAME_CHAR_RE.test(normalized)) {
        findings.push(
          find(
            skill,
            "metadata/name-format",
            "name must contain only letters, digits, and hyphens.",
            lineOf(skill.content, "name:"),
          ),
        );
      }
      const dir = basename(skill.bundleRoot).normalize("NFKC");
      if (normalized !== dir) {
        findings.push(
          find(
            skill,
            "metadata/name-matches-directory",
            `name "${normalized}" must match the skill directory name "${dir}".`,
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
