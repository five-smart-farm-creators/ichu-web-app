# ICHU Web App

[![Angular 22](https://img.shields.io/badge/Angular-22-DD0031?style=flat&logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase 13](https://img.shields.io/badge/Firebase-13-DD2C00?style=flat&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Proprietary](https://img.shields.io/badge/License-Proprietary-333333?style=flat)](LICENSE.md)

Angular web application for ICHU, the livestock management platform by SmartFarm. It provides the public pages (sign-in, registration, recovery, terms), the authenticated shell with account and advisory pages, and English and Latin American Spanish interfaces.

## Local setup

Use a Node.js version allowed by `package.json` and npm `11.19.0`. If `public/config.json` is absent, copy the tracked example and add the approved local settings:

```powershell
Copy-Item public/config.example.json public/config.json
```

The example sets `apiBaseUrl` to `http://localhost:5099/api/v1` and leaves Firebase Web fields (`apiKey`, `authDomain`, `projectId`, `appId`) empty. The app loads `public/config.json` before Angular bootstrap. This local file is ignored; do not commit it. Firebase Web configuration is public client configuration, but never put service-account keys or private credentials in browser files. See [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).

Start the backend separately at the configured URL for REST work. Without valid runtime configuration, sign-in remains unavailable.

```sh
npm ci
npm start
```

Open http://localhost:4200. The interface opens in English; choose Español from the language menu to switch.

## Scope and current status

All seven bounded contexts of the ICHU product are in scope for the application. This repository implements the application foundation (routing, shell, languages, API plumbing) and the Identity and Access Management (`iam`) context. The other six contexts, `cattle-information`, `iot-assets`, `operations-monitoring`, `planning`, `dashboard-analytics`, and `subscription-plans`, are not implemented yet.

Sign-in uses Firebase Authentication, then the ICHU API checks the account and ranch access. A Firebase identity alone does not grant application or ranch access.

## Languages

Interface copy lives in `public/i18n/en.json` (default) and `public/i18n/es.json` (Latin American Spanish). Both files must define the same keys; the test suite checks it. The language choice and the selected ranch are saved in this browser.

## Checks

```sh
npm run typecheck
npm run build
npm test -- --watch=false
```

On Windows, the `[2026-2]` folder name breaks Vitest. Run the tests through a drive that maps to the parent folder:

```powershell
subst X: "C:\Users\FLOR\Documents\IoT [2026-2]"
Set-Location X:\Repositorios\ichu-web-app
npx ng test --watch=false
Set-Location C:\
subst X: /D
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, naming, comments, and the Git workflow. The project is proprietary; see [LICENSE.md](LICENSE.md).
