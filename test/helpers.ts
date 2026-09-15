import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "skill-lint-"));
}

export async function writeTree(
  root: string,
  entries: Record<string, string>,
): Promise<void> {
  for (const [rel, body] of Object.entries(entries)) {
    const p = join(root, rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
}

export async function cleanup(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
