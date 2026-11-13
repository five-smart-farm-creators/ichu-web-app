# Contributing

Keep changes focused, preserve existing behavior and visual design, and stay within the requested bounded context.

## Setup and checks

Use a Node.js version allowed by `package.json` and npm `11.19.0`. Keep `public/config.json` local and uncommitted. Start the app with `npm start`; start the backend separately when validating REST calls.

Run the checks relevant to your change:

```sh
npm run typecheck
npm run build
npm test -- --watch=false
```

Do not claim live REST or end-to-end verification when the backend is unavailable. Report only checks actually performed.

## Domain-Driven Design

`iam`, `cattle-information`, `iot-assets`, `operations-monitoring`, `planning`, `dashboard-analytics`, and `subscription-plans` are implemented in the frontend.

Each context uses this structure when files are needed:

```text
src/app/features/<context>/
  domain/
    model/
    repositories/
  application/
    services/
    acl/
  infrastructure/
    repositories/
    http/
    configuration/
  presentation/
```

- `domain/model/` contains framework-independent models and pure business rules. It must not import Angular, browser APIs, Firebase, HTTP clients, or infrastructure packages.
- `domain/repositories/` defines ports owned by the domain.
- `application/services/` coordinates use cases through domain contracts.
- `application/acl/` holds facades that other contexts inject, such as `IamContextFacade`. No context imports another context's services, repositories, or models.
- `infrastructure/repositories/` implements ports and contains Firebase or REST adapters when required. Identify mock data as fixtures; do not describe it as a backend integration.
- `infrastructure/http/` holds interceptors that belong to the context, such as the IAM authorization interceptor.
- `presentation/` contains Angular UI and calls application services.

Keep dependencies directed inward. Put app-wide startup, runtime config, layout, and routes in `core/`. Keep `shared/` business-neutral: i18n, HTTP endpoint and error helpers, and shared presentation. Reuse the existing `Icon` and SCSS tokens. Preserve the current screen design and interaction patterns.

## Internationalization

English is the default language and the source of every key. Every user-visible string goes through `translate` (templates) or `TranslateService` (code); do not hard-code copy in templates. Keys are nested by area: `common`, `shell`, `pages`, `iam.<page>`, `iam.errors.<code>`, and `errors.<code>`.

`public/i18n/en.json` and `public/i18n/es.json` must define identical key sets, which the translation-files test enforces. Spanish is neutral Latin American Spanish with correct accents. Endonyms in the language menu stay in their own language.

Use DDD as a guide to cohesive domain boundaries and inward dependencies. [eShopOnWeb](https://github.com/dotnet-architecture/eShopOnWeb/wiki/Architecture) is a principles reference only; do not copy its .NET project structure.

## Naming, language, and comments

| Element | Convention |
| --- | --- |
| Folders and filenames | `kebab-case` |
| Classes, interfaces, type aliases, enums, and other types | `PascalCase` |
| Methods, properties, fields, parameters, and local variables | `camelCase` |

Use meaningful English identifiers and comments. Write UI copy in English in templates and in `public/i18n/en.json`; Spanish lives only in `public/i18n/es.json`. Follow the [Angular style guide](https://angular.dev/style-guide) where it fits these rules. Use `UPPER_SNAKE_CASE` for injection tokens and fixed validation-pattern constants; keep local computed values in `camelCase`.

Keep Angular components focused and consistent with the standalone app. Keep source files focused on one concept. Document public TypeScript contracts with concise JSDoc (`/** ... */`). Use `//` for a single-line note and `/* ... */` for a genuine multiline comment. Avoid decorative comments and commented-out code.

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
