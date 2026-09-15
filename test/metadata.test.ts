import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../src/frontmatter.js";
import { frontmatterRule } from "../src/rules/frontmatter.js";
import type { SkillFile } from "../src/types.js";

function makeSkill(content: string, path = "skills/demo/SKILL.md"): SkillFile {
  const { frontmatter, bodyStartLine } = parseFrontmatter(content);
  return {
    path,
    absolutePath: "/abs/" + path,
    bundleRoot: "/abs/skills/demo",
    scanRoot: "/abs",
    content,
    frontmatter,
    bodyStartLine,
  };
}

test("valid metadata produces no findings", () => {
  const s = makeSkill(`---
name: demo
description: Does a thing and when to use it.
license: MIT
compatibility: Requires git
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Read Bash(git:*)
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.deepEqual(findings, []);
});

test("missing description reports a stable rule id and location", () => {
  const s = makeSkill(`---
name: demo
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.ok(
    findings.some((f) => f.ruleId === "metadata/description-required"),
    "expected description-required finding",
  );
  const f = findings.find((x) => x.ruleId === "metadata/description-required")!;
  assert.equal(f.severity, "error");
  assert.equal(f.file, "skills/demo/SKILL.md");
  assert.equal(typeof f.line, "number");
});

test("invalid name format reports metadata/name-format", () => {
  const s = makeSkill(`---
name: Demo-Upper
description: Does a thing.
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/name-format"));
});

test("unicode name is valid and matches directory", () => {
  const s = makeSkill(
    `---
name: café
description: Does a thing.
---

# Café
`,
    "skills/café/SKILL.md",
  );
  s.bundleRoot = "/abs/skills/café";
  const findings = frontmatterRule.run(s);
  assert.deepEqual(findings, []);
});

test("consecutive hyphens still report metadata/name-format", () => {
  const s = makeSkill(`---
name: bad--name
description: Does a thing.
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/name-format"));
});

test("name not matching directory reports metadata/name-matches-directory", () => {
  const s = makeSkill(
    `---
name: other-name
description: Does a thing.
---

# Demo
`,
    "skills/demo/SKILL.md",
  );
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/name-matches-directory"));
});

test("description over 1024 characters reports metadata/description-length", () => {
  const s = makeSkill(`---
name: demo
description: ${"x".repeat(1025)}
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/description-length"));
});

test("metadata with non-string value reports metadata/metadata-string-values", () => {
  const s = makeSkill(`---
name: demo
description: Does a thing.
metadata:
  author: example-org
  count: 3
---

# Demo
`);
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/metadata-string-values"));
});

test("missing frontmatter reports metadata/missing-frontmatter", () => {
  const s = makeSkill(`# Demo\n\nNo frontmatter here.\n`);
  const findings = frontmatterRule.run(s);
  assert.ok(findings.some((f) => f.ruleId === "metadata/missing-frontmatter"));
});
