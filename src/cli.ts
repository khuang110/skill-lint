#!/usr/bin/env node
import { loadSkills } from "./loader.js";
import { lintSkills, countBySeverity } from "./lint.js";
import type { Finding } from "./types.js";

type Format = "text" | "json" | "github";

interface Options {
  path: string;
  format: Format;
  strict: boolean;
  catalog: boolean;
}

function parseArgs(argv: string[]): Options {
  let path = ".";
  let format: Format = "text";
  let strict = false;
  let catalog = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format" || a === "-f") {
      const v = argv[++i];
      if (v === "json" || v === "text" || v === "github") format = v;
      else usageError(`unknown format: ${v}`);
    } else if (a === "--strict") {
      strict = true;
    } else if (a === "--catalog") {
      catalog = true;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("-")) {
      usageError(`unknown option: ${a}`);
    } else {
      path = a;
    }
  }
  return { path, format, strict, catalog };
}

function usageError(msg: string): never {
  process.stderr.write(`skilllint: ${msg}\n`);
  process.stderr.write("Run `skilllint --help` for usage.\n");
  process.exit(2);
}

function printHelp(): void {
  process.stdout.write(`skilllint — catch broken skill bundles before release

Usage:
  skilllint [path] [--format text|json|github] [--strict] [--catalog]

Options:
  path              File, skill directory, or repository to scan (default: .)
  -f, --format      Output format (default: text)
  --strict          Treat warnings as errors (non-zero exit)
  --catalog         Treat the path as a monorepo skill catalog (ignore cross-skill links)
  -h, --help        Show this help

Exit codes:
  0  completed scan, no errors (no warnings under --strict)
  1  lint errors found
  2  invalid invocation or incomplete scan
`);
}

function escapeGithub(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

function formatText(
  findings: Finding[],
  issues: { severity: string; path: string; message: string }[],
  sizes: { path: string; lines: number; bytes: number }[],
  skillCount: number,
): string {
  const out: string[] = [];
  for (const f of findings) {
    out.push(`${f.file}:${f.line}  ${f.severity}  ${f.ruleId}`);
    out.push(`  ${f.message}`);
  }
  for (const i of issues) {
    out.push(`${i.path}: ${i.severity}  ${i.message}`);
  }
  if (findings.length || issues.length) out.push("");
  out.push(`${skillCount} skill(s) checked`);
  const { errors, warnings } = countBySeverity(findings);
  out.push(`${errors} error(s), ${warnings} warning(s)`);
  if (sizes.length) {
    out.push(
      "Entry sizes: " +
        sizes.map((s) => `${s.path} ${s.lines} lines / ${s.bytes}B`).join(", "),
    );
  }
  return out.join("\n");
}

function formatGithub(findings: Finding[]): string {
  const out: string[] = [];
  for (const f of findings) {
    const level = f.severity === "error" ? "error" : "warning";
    out.push(
      `::${level} file=${escapeGithub(f.file)},line=${f.line},title=${escapeGithub(f.ruleId)}::${escapeGithub(f.message)}`,
    );
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const result = await loadSkills(opts.path);

  if (result.skills.length === 0) {
    process.stderr.write(
      `skilllint: no SKILL.md files found under ${opts.path}\n`,
    );
    process.exit(2);
  }

  const lint = await lintSkills(result.skills, { catalog: opts.catalog });
  const { errors, warnings } = countBySeverity(lint.findings);

  if (opts.format === "json") {
    process.stdout.write(
      JSON.stringify(
        {
          skills: lint.skills.map((s) => s.path),
          issues: result.issues,
          findings: lint.findings,
          sizes: lint.sizes,
          errors,
          warnings,
        },
        null,
        2,
      ) + "\n",
    );
  } else if (opts.format === "github") {
    process.stdout.write(formatGithub(lint.findings) + "\n");
  } else {
    process.stdout.write(
      formatText(
        lint.findings,
        result.issues,
        lint.sizes,
        lint.skills.length,
      ) + "\n",
    );
  }

  const failed = errors > 0 || (opts.strict && warnings > 0);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`skilllint: ${(err as Error).message}\n`);
  process.exit(2);
});
