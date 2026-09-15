import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSkills } from "../src/loader.js";
import { makeTempDir, writeTree, cleanup } from "./helpers.js";

const VALID = `---
name: demo
description: Does a thing.
---

# Demo
`;

test("discovers nested and hidden skill directories exactly once", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      ".claude/skills/a/SKILL.md": VALID.replace("name: demo", "name: a"),
      "skills/cat/b/SKILL.md": VALID.replace("name: demo", "name: b"),
      "README.md": "# not a skill",
    });
    const result = await loadSkills(root);
    const paths = result.skills.map((s) => s.path).sort();
    assert.deepEqual(paths, [
      ".claude/skills/a/SKILL.md",
      "skills/cat/b/SKILL.md",
    ]);
    assert.equal(result.issues.length, 0);
  } finally {
    await cleanup(root);
  }
});

test("skips node_modules and .git", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "node_modules/pkg/SKILL.md": VALID,
      ".git/skills/SKILL.md": VALID,
      "skills/real/SKILL.md": VALID.replace("name: demo", "name: real"),
    });
    const result = await loadSkills(root);
    assert.deepEqual(
      result.skills.map((s) => s.path),
      ["skills/real/SKILL.md"],
    );
  } finally {
    await cleanup(root);
  }
});

test("accepts an explicit SKILL.md file path", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, { "skills/demo/SKILL.md": VALID });
    const result = await loadSkills(root + "/skills/demo/SKILL.md");
    assert.deepEqual(result.skills.map((s) => s.path), ["SKILL.md"]);
  } finally {
    await cleanup(root);
  }
});
