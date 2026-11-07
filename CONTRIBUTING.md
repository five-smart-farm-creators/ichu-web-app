# Contributing to IchuWebApp

Thank you for contributing. This guide describes how to propose changes, structure domain-oriented code, and keep our Git history and releases predictable.

## Development setup

Use the Node.js version supported by the project and npm version declared in `package.json`. Install dependencies and start the Angular development server:

```bash
npm ci
npm start
```

Before opening a pull request, run the checks relevant to your change:

```bash
npm test
npm run build
```

Keep changes focused, follow the existing Angular and TypeScript conventions, and update tests and documentation when behavior changes. Do not commit credentials, secrets, generated build output, or unrelated formatting changes.

## Domain-Driven Design

Model code around the language and rules of the business, not just around screens or technical layers:

- Use domain terminology consistently in names, user interfaces, tests, and discussions. Clarify ambiguous terms with the team before introducing competing names.
- Group related behavior and data by domain capability or bounded context. Keep responsibilities and boundaries explicit; avoid a single catch-all model shared by unrelated features.
- Put business rules close to the domain concepts they protect. Keep presentation and Angular-specific concerns at the edges, and avoid making domain rules depend unnecessarily on framework or infrastructure details.
- Make invariants explicit and validate them at the appropriate boundary. Do not duplicate rules across components.
- Prefer small, cohesive changes that preserve existing boundaries. Introduce abstractions only when they represent a real domain concept or remove meaningful coupling.

Use the current project structure as a guide; do not create layers or bounded contexts solely to follow a pattern. Explain significant domain or architecture changes in the pull request.

## Branching: Git Flow

Use Git Flow to keep ongoing work separate from releasable code:

| Branch | Purpose |
| --- | --- |
| `main` | Production-ready, released code |
| `develop` | Integration branch for the next release |
| `feature/<short-description>` | New work; branch from and merge back into `develop` |
| `bugfix/<short-description>` | Non-urgent fixes; branch from and merge back into `develop` |
| `release/vX.Y.Z` | Stabilization and release preparation; branch from `develop`, then merge into `main` and back into `develop` |
| `hotfix/vX.Y.Z` | Urgent production fixes; branch from `main`, then merge into `main` and `develop` |

Use lowercase, descriptive branch names with hyphens, for example `feature/irrigation-schedule` or `bugfix/login-validation`. Do not push directly to `main` or `develop`; open a pull request to the appropriate target branch. Keep branches current, resolve conflicts deliberately, and delete merged branches.

Never open a pull request from `develop` to `main`; releases always go through `release/vX.Y.Z`. Do not use other branch prefixes, such as `fix/`, `docs/`, `refactor/`, `chore/`, or `audit/`.

## Commit messages: Conventional Commits

Write each commit message in this format:

```text
<type>(<scope>)[!]: <imperative summary>

[optional body]

[optional footer(s)]
```

Use a concise, imperative summary. Common types:

- `feat`: add user-facing functionality
- `fix`: correct a defect
- `docs`: documentation-only change
- `test`: add or update tests
- `refactor`: restructure code without changing behavior
- `style`: formatting or other non-functional style change
- `perf`: improve performance
- `build`: change build or dependency configuration
- `ci`: change automation or CI configuration
- `chore`: maintenance that does not fit another type
- `revert`: revert a previous commit

Use a scope to identify the affected area, preferably using domain language, such as `feat(planning): schedule vaccination activities`. Examples:

```text
feat(cattle-information): register cattle in a lot
fix(iam): reject expired sessions
docs: clarify local setup
```

Commit messages must also follow these rules:

- Start the summary with a lowercase letter, without a trailing period, and keep the header at most 72 characters.
- Use only these scopes: `iam`, `cattle-information`, `iot-assets`, `operations-monitoring`, `planning`, `dashboard-analytics`, `subscription-plans`, `shared`, `i18n`.
- Use `feat` only for new functionality, `docs` for documentation and diagram changes, and `chore` for changelog, version, or maintenance changes.
- Do not use the default message of the GitHub web editor, such as `Update file.md`.

Invalid examples:

```text
(Docs): Add user personas
Update chapter02.md
feat: add controllers.
faet: add planning service
```

Mark a breaking change with `!` after the type/scope and explain it in the footer using `BREAKING CHANGE:`:

```text
feat(operations-monitoring)!: replace the legacy alert status

BREAKING CHANGE: clients must use the new alert status values.
```

Do not use a `feat` or `fix` type merely to influence versioning; the commit must accurately describe the change. Keep commits coherent and avoid bundling unrelated work.

## Semantic versioning

Use `MAJOR.MINOR.PATCH` versions (`X.Y.Z`) for releases:

- **MAJOR** for incompatible public API or behavior changes.
- **MINOR** for backward-compatible functionality.
- **PATCH** for backward-compatible bug fixes.

Before `1.0.0`, the public contract is not considered stable: `0.MINOR.PATCH` releases may still introduce incompatible changes, which must be clearly documented. A `1.0.0` release signals that the public contract is stable. Pre-releases may use identifiers such as `1.2.0-rc.1`; do not present them as final releases.

For each release, update the version in the relevant project manifest, summarize user-visible changes, and create a Git tag matching the version with a `v` prefix (for example, `v1.2.0`). Keep release notes and breaking-change migration guidance accurate. Conventional Commits can help identify release impact, but maintainers decide and verify the actual version based on the complete release contents and compatibility.

## Pull requests and review

Open pull requests against `develop` for normal work, or the branch prescribed above for release and hotfix work. Include:

- The problem being addressed and the approach taken.
- Any relevant domain context, behavior changes, and trade-offs.
- Tests or manual verification performed, plus known limitations.
- Screenshots or recordings for visible UI changes when useful.

Keep pull requests reviewable and focused. Link related issues, respond constructively to feedback, and make sure automated checks pass. Reviewers should assess correctness, tests, domain consistency, accessibility where relevant, and whether documentation or migration notes are needed. Do not merge until required approvals and checks are complete.

## Commit granularity

A commit is one complete logical change that can be described in a single sentence and leaves the project working.

| Too fine | Balanced | Too coarse |
| --- | --- | --- |
| One commit per folder or file (`feat: add commands models`, `feat: add events models`, ...) | `feat(iot-assets): add device aggregate with commands and events` | `feat: implement iot assets` (a whole bounded context) |
| Several consecutive typo commits | `docs(chapter-ii): add segment 1 interview analysis` | `docs: update report` |

- Code: a feature branch usually has 3 to 8 commits of roughly 3 to 10 files each, split by layer or use case (for example domain model, persistence, REST endpoints, tests).
- Documentation: one commit per complete artifact or section, not per paragraph and not per whole chapter.
- Group typo fixes with the section they belong to; a later round of fixes goes in a single `docs(<scope>): fix typos in <section>` commit.
- Before pushing a branch that only you use, squash local work-in-progress commits into logical commits. Never rewrite commits that are already published.
- The convention is enforced for commits created from 2026-11-07, when it was adopted; older history is kept unchanged.

## Enforcement

- After cloning, run once: `git config core.hooksPath .githooks`. The `commit-msg` hook rejects invalid messages locally.
- The `Git Flow checks` GitHub Actions workflow validates the branch name, the pull request target, and every commit message on pull requests to `main` and `develop`.
- Configure Git with your real name and the email linked to your GitHub account (`git config user.name` and `git config user.email`). `.mailmap` maps previously used alternative identities.
