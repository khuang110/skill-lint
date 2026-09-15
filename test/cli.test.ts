import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTempDir, writeTree, cleanup } from "./helpers.js";

const execFileP = promisify(execFile);
const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

async function run(args: string[]): Promise<{ code: number; out: string; err: string }> {
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [cli, ...args]);
    return { code: 0, out: stdout, err: stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 2, out: err.stdout ?? "", err: err.stderr ?? "" };
  }
}

const GOOD = `---
name: demo
description: Does a thing.
---

# Demo
`;

test("clean skill exits 0", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, { "skills/demo/SKILL.md": GOOD });
    const r = await run([root]);
    assert.equal(r.code, 0);
  } finally {
    await cleanup(root);
  }
});

test("broken skill exits 1", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [missing](nope.md).
`,
    });
    const r = await run([root]);
    assert.equal(r.code, 1);
  } finally {
    await cleanup(root);
  }
});

test("warning-only skill exits 0 by default and 1 under --strict", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

${"# x\n".repeat(600)}
`,
    });
    const normal = await run([root]);
    assert.equal(normal.code, 0);
    const strict = await run([root, "--strict"]);
    assert.equal(strict.code, 1);
  } finally {
    await cleanup(root);
  }
});

test("no skills found exits 2", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, { "README.md": "# no skills here" });
    const r = await run([root]);
    assert.equal(r.code, 2);
    assert.match(r.err, /no SKILL\.md files found/);
  } finally {
    await cleanup(root);
  }
});

test("unknown option exits 2", async () => {
  const r = await run(["--bogus"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown option/);
});

test("help and error text use the skilllint binary name", async () => {
  const help = await run(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.out, /skilllint/);
  assert.ok(!help.out.includes("skill-lint"), "must not advertise the taken name");

  const err = await run(["--bogus"]);
  assert.equal(err.code, 2);
  assert.match(err.err, /skilllint/);
  assert.ok(!err.err.includes("skill-lint"), "error text must use the binary name");
});

test("github format escapes user-controlled text", async () => {
  const root = await makeTempDir();
  try {
    await writeTree(root, {
      "skills/demo/SKILL.md": `---
name: demo
description: Does a thing.
---

See [missing](nope.md).
`,
    });
    const r = await run([root, "--format", "github"]);
    assert.equal(r.code, 1);
    assert.match(r.out, /::error file=/);
    assert.match(r.out, /title=references\/missing/);
    assert.ok(!r.out.includes("\n  "), "must be single-line annotations");
  } finally {
    await cleanup(root);
  }
});
