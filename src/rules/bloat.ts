import type { Finding, Rule, SkillFile } from "../types.js";

/** Rough token estimate: ~4 characters per token for English text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const RECOMMENDED_LINES = 500;
const RECOMMENDED_TOKENS = 5_000;

/**
 * Report transparent size guidance. The Agent Skills spec recommends keeping
 * SKILL.md under 500 lines and its instructions under 5000 tokens; these are
 * recommendations, not hard limits, so they are warnings only.
 */
export const bloatRule: Rule = {
  id: "size",
  description:
    "Warn when SKILL.md exceeds the spec's recommended body budget.",
  run(skill: SkillFile): Finding[] {
    const lines = skill.content.split("\n").length;
    const tokens = estimateTokens(skill.content);
    const findings: Finding[] = [];
    if (lines > RECOMMENDED_LINES) {
      findings.push({
        ruleId: "size/body-lines",
        severity: "warning",
        file: skill.path,
        line: 1,
        message: `SKILL.md is ${lines} lines (spec recommends under ${RECOMMENDED_LINES}). Move detail into references/ files.`,
      });
    }
    if (tokens > RECOMMENDED_TOKENS) {
      findings.push({
        ruleId: "size/body-tokens",
        severity: "warning",
        file: skill.path,
        line: 1,
        message: `SKILL.md is ~${tokens} tokens (spec recommends under ${RECOMMENDED_TOKENS}). Move detail into references/ files.`,
      });
    }
    return findings;
  },
};
