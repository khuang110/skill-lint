# skilllint

skilllint checks agent skill bundles before you release them. It runs offline. It does not change files.

It answers one question: will this skill work when someone installs it?

## What it checks

- SKILL.md frontmatter. It must have a valid `name` and `description`.
- Local links. It finds links that point to missing files.
- Bundle boundaries. It warns when a link points outside the skill directory.
- Entry file size. It warns when SKILL.md is larger than the specification recommends.

## What it does not check

skilllint is not a security scanner. It does not judge prompt quality. It does not fetch web links. It does not run scripts.

For security scanning, use a tool built for that purpose.

## Install

Install from Git (the package is not yet on the npm registry):

```bash
npm install -g github:khuang110/skill-lint
```

This runs the `prepare` script, which builds the CLI from TypeScript.

## Use

```bash
# Check the current directory
skilllint .

# Check a specific skill directory
skilllint ./skills/my-skill

# Check a repository
skilllint ./my-repo

# Machine-readable output
skilllint . --format json

# GitHub Actions annotations
skilllint . --format github

# Treat warnings as errors
skilllint . --strict
```

## Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | Scan completed. No errors. |
| 1 | Scan completed. Errors found. |
| 2 | Invalid input or incomplete scan. |

## Example

A skill links to a file that is missing:

```text
references/setup.md:1  error  references/missing
  Linked file does not exist: references/checklist.md.
  Referenced through: SKILL.md -> references/setup.md.
```

## Use in CI

```yaml
# .github/workflows/skilllint.yml
name: skilllint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx skilllint . --format github --strict
```

Or with the `--format github` output for inline PR annotations:

```yaml
      - run: npx skilllint . --format github --strict
```

Exit code 1 (errors found) fails the build. Use `--strict` to also fail on
warnings.

## Scope

skilllint reads files inside the skill bundle only. It does not read files
outside the bundle. It does not send data over the network. It does not write
files.

## Development

```bash
npm install
npm test
```

## License

MIT. See [LICENSE](LICENSE).
