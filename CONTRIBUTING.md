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
| `release/<version>` | Stabilization and release preparation; branch from `develop`, then merge into `main` and back into `develop` |
| `hotfix/<short-description>` | Urgent production fixes; branch from `main`, then merge into `main` and `develop` |

Use lowercase, descriptive branch names with hyphens, for example `feature/irrigation-schedule` or `hotfix/login-validation`. Do not push directly to `main` or `develop`; open a pull request to the appropriate target branch. Keep branches current, resolve conflicts deliberately, and delete merged branches.

## Commit messages: Conventional Commits

Write each commit message in this format:

```text
<type>[optional scope][!]: <imperative summary>

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

Use an optional scope to identify the affected area, preferably using domain language, such as `feat(irrigation): schedule watering`. Examples:

```text
feat(inventory): track seed stock
fix(auth): reject expired sessions
docs: clarify local setup
```

Mark a breaking change with `!` after the type/scope and explain it in the footer using `BREAKING CHANGE:`:

```text
feat(api)!: replace the legacy crop status

BREAKING CHANGE: clients must use the new crop status values.
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
