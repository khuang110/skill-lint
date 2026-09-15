import { parse } from "yaml";

export interface FrontmatterResult {
  frontmatter: Record<string, unknown> | null;
  bodyStartLine: number;
}

/**
 * Parse the YAML frontmatter block at the top of a SKILL.md file.
 * Returns null when there is no frontmatter or it cannot be parsed.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith("---")) {
    return { frontmatter: null, bodyStartLine: 1 };
  }
  const lines = content.split("\n");
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { frontmatter: null, bodyStartLine: 1 };
  }
  const yamlText = lines.slice(1, close).join("\n");
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch {
    return { frontmatter: null, bodyStartLine: 1 };
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { frontmatter: null, bodyStartLine: 1 };
  }
  return {
    frontmatter: parsed as Record<string, unknown>,
    bodyStartLine: close + 2,
  };
}
