# ICHU IAM Web App

[![Angular 22](https://img.shields.io/badge/Angular-22-DD0031?style=flat&logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase 13](https://img.shields.io/badge/Firebase-13-DD2C00?style=flat&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Proprietary](https://img.shields.io/badge/License-Proprietary-333333?style=flat)](LICENSE.md)

Angular web application for ICHU Identity and Access Management (`iam`), with Firebase authentication and REST account, profile, and ranch-access operations. This app is scoped to IAM; the other six agreed contexts are future work, not implemented modules.

## Local setup

Use a Node.js version allowed by `package.json` and npm `11.19.0`. If `public/config.json` is absent, copy the tracked example and add the approved local settings:

```powershell
Copy-Item public/config.example.json public/config.json
```

The example sets `apiBaseUrl` to `http://localhost:5099/api/v1` and leaves Firebase Web fields (`apiKey`, `authDomain`, `projectId`, `appId`) empty. The app loads `public/config.json` before Angular bootstrap. This local file is ignored; do not commit it. Firebase Web configuration is public client configuration, but never put service-account keys or private credentials in browser files. See [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).

Start the backend separately at the configured URL for REST work. Without valid runtime configuration, IAM sign-in remains unavailable.

```sh
npm ci
npm start
```

Open http://localhost:4200. The IAM interface is in English.

## Scope and current status

The application includes sign-in, registration, email verification, password recovery, guarded account access, professional profiles, and advisory workflows. It reuses shared icons and SCSS design tokens. IAM is the only active bounded-context scope. The agreed future contexts are `cattle-information`, `iot-assets`, `operations-monitoring`, `planning`, `dashboard-analytics`, and `subscription-plans`.

Run a configured ICHU backend alongside the app. A Firebase identity alone does not grant application or ranch access.

Preserve the existing visual design and reuse the shared icon and tokens in `src/styles/tokens/`. See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, naming, comments, and future repository workflow. The project is proprietary; see [LICENSE.md](LICENSE.md).

## Checks

```sh
npm run typecheck
npm run build
npm test -- --watch=false
```