import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSkills } from "../src/loader.js";
import { checkReferences } from "../src/references.js";
import { makeTempDir, writeTree, cleanup } from "./helpers.js";

const ENTRY = `---
name: demo
description: Does a thing.
---

See [setup](references/setup.md).
`;

test("reports a missing reference with its chain", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": ENTRY,
      "skills/demo/references/setup.md": "See [checklist](checklist.md).\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    const missing = findings.filter((f) => f.ruleId === "references/missing");
    assert.equal(missing.length, 1);
    assert.equal(missing[0].file, "references/setup.md");
    assert.match(missing[0].message, /SKILL\.md -> references\/setup\.md/);
    assert.match(missing[0].message, /references\/checklist\.md/);
  } finally {
    await cleanup(root);
  }
});

test("out-of-bundle link to a missing file reports missing", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [outside](../outside.md).
`,
      // The external file is deliberately absent; we must not try to read it.
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    const missing = findings.filter((f) => f.ruleId === "references/missing");
    assert.equal(missing.length, 1);
    assert.equal(missing[0].severity, "error");
  } finally {
    await cleanup(root);
  }
});

test("cross-skill link to an existing file is a warning, not missing", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [other](../other-skill/SKILL.md).
`,
      "skills/other-skill/SKILL.md": `---
name: other-skill
description: Other.
---

# Other
`,
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    const cross = findings.filter((f) => f.ruleId === "references/cross-skill");
    assert.equal(cross.length, 1);
    assert.equal(cross[0].severity, "warning");
    assert.ok(!findings.some((f) => f.ruleId === "references/missing"));
  } finally {
    await cleanup(root);
  }
});

test("catalog mode suppresses cross-skill warnings", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [other](../other-skill/SKILL.md).
`,
      "skills/other-skill/SKILL.md": `---
name: other-skill
description: Other.
---

# Other
`,
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0], { catalog: true });
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("link to a directory is a valid reference, not missing", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [examples](examples/).
`,
      "skills/demo/examples/readme.txt": "hi\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("resolves reference-style links", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [the setup][setup].

[setup]: references/setup.md
`,
      "skills/demo/references/setup.md": "ok\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("heading anchors are ignored when the file exists", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [setup](references/setup.md#install).
`,
      "skills/demo/references/setup.md": "# Install\n\nok\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("template placeholders are ignored", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [Title](URL) and [docs](<your-url>).
`,
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});

test("URL-encoded link paths are decoded before resolution", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [file](references/my%20file.md).
`,
      "skills/demo/references/my file.md": "ok\n",
    });
    const result = await loadSkills(root);
    const findings = await checkReferences(result.skills[0]);
    assert.deepEqual(findings, []);
  } finally {
    await cleanup(root);
  }
});
