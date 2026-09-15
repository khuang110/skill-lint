# skill-lint

skill-lint checks agent skill bundles before you release them. It runs offline. It does not change files.

It answers one question: will this skill work when someone installs it?

## What it checks

- SKILL.md frontmatter. It must have a valid `name` and `description`.
- Local links. It finds links that point to missing files.
- Bundle boundaries. It warns when a link points outside the skill directory.
- Entry file size. It warns when SKILL.md is larger than the specification recommends.

## What it does not check

skill-lint is not a security scanner. It does not judge prompt quality. It does not fetch web links. It does not run scripts.

For security scanning, use a tool built for that purpose.

## Install

```bash
npm install -g skill-lint
```

## Use

```bash
# Check the current directory
skill-lint .

# Check a specific skill directory
skill-lint ./skills/my-skill

# Check a repository
skill-lint ./my-repo

# Machine-readable output
skill-lint . --format json

# GitHub Actions annotations
skill-lint . --format github

# Treat warnings as errors
skill-lint . --strict
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

## Scope

skill-lint reads files inside the skill bundle only. It does not read files
outside the bundle. It does not send data over the network. It does not write
files.

## Development

```bash
npm install
npm test
```

## License

License is not yet selected.
