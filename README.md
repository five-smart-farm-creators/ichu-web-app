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

All seven bounded contexts of the ICHU product are in scope for the application. This repository implements the application foundation (routing, shell, languages, API plumbing), the Identity and Access Management (`iam`) context, the animal and lot screens of the Cattle Information (`cattle-information`) context, the device, water trough, and edge gateway screens of the IoT Assets (`iot-assets`) context, the monitoring screens of the Operations and Monitoring (`operations-monitoring`) context: herd overview, animal telemetry, alerts, normal ranges, location and fences, the clinical history of each animal, and the reproductive history of each female, and the planning screens of the Planning (`planning`) context: calendar, campaigns, withdrawal periods, and the nutrition plan of each lot with its rumination evolution. The Dashboard and Analytics (`dashboard-analytics`) context adds the herd dashboard, the reports (lot trends, epidemiological curve, executive report), and the portfolio of advised ranches. The Subscription Plans (`subscription-plans`) context adds the plan comparison with the annual price quoted for a head count, the subscription request with Stripe Checkout, My plan with payment and cancellation, and the pages where Stripe returns the visitor.

## Map

The location and fences screen draws grazing zones and last known positions with Leaflet on OpenStreetMap. The map needs no key, account, or entry in `public/config.json`. Its tiles come from `tile.openstreetmap.org`, a third-party service; keep the OpenStreetMap attribution visible, as the tile usage policy requires. This app serves the Leaflet stylesheet from `/vendor/leaflet/` and bundles the library as a lazy chunk; both load only when that screen opens. If they cannot load, the location screen shows a notice and its tables keep working.

Sign-in uses Firebase Authentication, then the ICHU API checks the account and ranch access. A Firebase identity alone does not grant application or ranch access.

## Subscriptions

`TERMS_VERSION` in `src/app/core/layout/terms.ts` (currently `2026-11`) is the Terms of Service version shown on the terms page and sent with each subscription request. It must equal the API setting `SubscriptionPlans:CurrentTermsVersion`; the API refuses a request that accepts another version.

Stripe Checkout returns the visitor to `/subscriptions/payment/success` or `/subscriptions/payment/cancel`. These paths must match the API settings `Stripe:SuccessUrl` and `Stripe:CancelUrl`; the API appends the `session_id` parameter to the success URL.

The landing page links to `/plans?tier=<Basic|Standard|Pro>&headCount=<n>&source=<text>`. The `source` value is stored as the acquisition source when it has at most 64 characters; otherwise `web-app` is stored. A visitor who is not signed in signs in first and then returns to the same address.

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
