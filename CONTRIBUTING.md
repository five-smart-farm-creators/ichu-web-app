# Contributing

Keep changes focused, preserve existing behavior and visual design, and follow the current IAM scope.

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

Only `iam` is in the current frontend scope. The agreed future contexts are `cattle-information`, `iot-assets`, `operations-monitoring`, `planning`, `dashboard-analytics`, and `subscription-plans`; do not create their modules without an authorized task.

As IAM code is added, use this structure when files are needed:

```text
src/app/features/iam/
  domain/
    model/
    repositories/
  application/
    services/
  infrastructure/
    repositories/
  presentation/
```

- `domain/model/` contains framework-independent models and pure business rules. It must not import Angular, browser APIs, Firebase, HTTP clients, or infrastructure packages.
- `domain/repositories/` defines ports owned by the domain.
- `application/services/` coordinates use cases through domain contracts.
- `infrastructure/repositories/` implements ports and contains Firebase or REST adapters when required. Identify mock data as fixtures; do not describe it as a backend integration.
- `presentation/` contains Angular UI and calls application services.

Keep dependencies directed inward. Put app-wide startup and runtime config in the existing `core/config/`. Keep `shared/` business-neutral. Reuse the existing `Icon` and SCSS tokens. Preserve the current screen design and interaction patterns.

Use DDD as a guide to cohesive domain boundaries and inward dependencies. [eShopOnWeb](https://github.com/dotnet-architecture/eShopOnWeb/wiki/Architecture) is a principles reference only; do not copy its .NET project structure.

## Naming, language, and comments

| Element | Convention |
| --- | --- |
| Folders and filenames | `kebab-case` |
| Classes, interfaces, type aliases, enums, and other types | `PascalCase` |
| Methods, properties, fields, parameters, and local variables | `camelCase` |

Use meaningful English identifiers and comments. Write all UI copy in English. Follow the [Angular style guide](https://angular.dev/style-guide) where it fits these rules.

Keep Angular components focused and consistent with the standalone app. Keep source files focused on one concept. Document public TypeScript contracts with concise JSDoc (`/** ... */`). Use `//` for a single-line note and `/* ... */` for a genuine multiline comment. Avoid decorative comments and commented-out code.

## Future repository workflow

When Git-based collaboration is authorized, use Git Flow: `main` for released code, `develop` for integration, `feature/<short-description>` and `bugfix/<short-description>` from `develop`, `release/<version>` from `develop`, and `hotfix/<short-description>` from `main`. Do not hardcode a transient branch name in project documentation.

Write commit messages in English using [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope][!]: <imperative summary>
```

Use types such as `feat`, `fix`, `docs`, `test`, `refactor`, `build`, and `chore`. Keep commits focused and explain breaking changes.
Use `UPPER_SNAKE_CASE` for injection tokens and fixed validation-pattern constants; keep local computed values in `camelCase`.
