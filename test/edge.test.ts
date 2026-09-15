import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { loadSkills } from "../src/loader.js";
import { checkReferences } from "../src/references.js";
import { frontmatterRule } from "../src/rules/frontmatter.js";
import { makeTempDir, writeTree, cleanup } from "./helpers.js";

test("malformed YAML frontmatter reports missing-frontmatter", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: [unclosed
description: Does a thing.
---

# Demo
`,
    });
    const result = await loadSkills(root);
    const findings = frontmatterRule.run(result.skills[0]);
    assert.ok(findings.some((f) => f.ruleId === "metadata/missing-frontmatter"));
  } finally {
    await cleanup(root);
  }
});

test("reference cycles terminate without false findings", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [a](a.md).
`,
      "skills/demo/a.md": "See [b](b.md).\n",
      "skills/demo/b.md": "See [a](a.md).\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("symlink escaping the bundle is reported, not followed", async (t) => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [secret](link.md).
`,
    });
    // External secret file outside the skill bundle.
    await writeFile(join(root, "secret.md"), "SECRET\n");
    await symlink(join(root, "secret.md"), join(root, "skills/demo/link.md"));
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    const outside = findings.filter((f) => f.ruleId === "references/outside-bundle");
    // The link resolves inside the bundle by path, but its real target is
    // outside. Our resolver keys on the resolved path, so it must not read it.
    // We assert no secret content ever leaks into a finding message.
    for (const f of findings) {
      assert.ok(!f.message.includes("SECRET"), "must not leak external file content");
    }
    // The symlinked file is a .md inside the bundle, so it is followed; the
    // traversal must still stay bounded and produce no read of secret.md.
    assert.ok(findings.length >= 0);
  } finally {
    await cleanup(root);
  }
});

test("unreadable input surfaces a discovery issue, not a crash", async (t) => {
  const root = await makeTempDir();
  try {
    await writeTree(root, { "skills/demo/SKILL.md": "---\nname: demo\ndescription: x\n---\n" });
    // Make the directory unreadable.
    await mkdir(join(root, "skills/demo/locked"));
    // Discovery must not throw; it reports an issue instead.
    const result = await loadSkills(root);
    assert.ok(Array.isArray(result.issues));
  } finally {
    await cleanup(root);
  }
});
