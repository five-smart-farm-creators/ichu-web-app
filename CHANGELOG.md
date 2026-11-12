# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Herd monitoring with the latest body temperature, activity, rumination and last known position of each active animal, a lot filter, stale and missing values labelled instead of shown as zero, and Excel and PDF downloads.
- Animal monitoring with latest values, a 24-hour, 7-day, 30-day or custom period, charts with the threshold band, statistics (valid readings, minimum, maximum, average, standard deviation and share outside the threshold), a readings table, and Excel and PDF downloads.
- Normal ranges per productive stage and metric, with a table and a dialog to configure them; a range requires a minimum below its maximum.
- Alerts queue with status and animal filters, paging, severity and status badges, a detail drawer with values against their thresholds or the grazing zone, and attention given with a finding and an optional action.
- Location and fences screen: grazing zones drawn on Google Maps with map clicks, moved and removed corners, redefinition, and the last known position of each active animal, with tables that list the same data.
- Location & fences, Monitoring and Alerts entries in the navigation menu, and a Monitoring link on the animal profile.
- Optional `googleMaps` runtime configuration for the map; without it the location screen still shows its tables and a notice.
- Animals screen with exact ear tag, status and lot filters, paging, animal registration, and Excel and PDF downloads.
- Animal profile with details, stage history, collar status, and actions to edit data, change the productive stage, and record an exit; exited animals are read-only.
- Lots with member counts, the animals of each lot by ear tag, adding and removing animals, and Excel and PDF downloads.
- Animals entry in the navigation menu.
- IoT devices screen with serial, type, status, communication and battery, filters, registration, maintenance, collar and controller assignment, release with a reason, assignment history, and Excel and PDF downloads.
- Water troughs with their lot, temperature bands, registration, and Excel and PDF downloads.
- Edge gateways with registration, where the key is shown once, revocation, and Excel and PDF downloads.
- IoT devices entry in the navigation menu.
- English and Latin American Spanish interface, with a language menu; English is the default and the choice is remembered in this browser.
- Application shell with navigation, ranch selector, role, account menu, and footer for signed-in pages.
- Shared footer with terms and privacy link on public pages, plus a skip link on every page.
- Translated page titles and meta description that follow the selected language.
- Ranch names in navigation and account pages, with a numbered fallback when a ranch has no name.
- Veterinarians confirm a ranch by its access code before requesting access.
- Ranch managers see the access code of each ranch they manage, with a button to copy it.
- Ranch managers review advisory requests in a table filtered by status; granting access asks for a scope and last valid day.
- Dates follow the selected language, English or Latin American Spanish.

### Changed

- Account and advisories are separate pages: the account page shows identity, ranch access, and the professional profile; the advisories page handles access requests and decisions.
- Professional profile changes are checked for specialty, license number, and years of experience before saving.
- Granted access ends at the close of the selected day in local time.
- Sign-in verifies the Firebase identity and then the ICHU account, without a separate backend session request.
- Errors show the message from the ICHU service in the selected language, or a translated fallback.
- Herd advisory requests and decisions use ranch-scoped endpoints.
- Terms and privacy page describes how ICHU handles sign-in, ranch records, browser preferences, and payments.
- Sign-in and account screens use the shared app layout and show no internal account or ranch identifiers.

### Removed

- Direct access grant form for ranch managers; access is granted by reviewing a pending request.
- Ranch ID entry for access requests; veterinarians enter the ranch access code instead.
- The combined account workspace page; its content moved to the account and advisories pages.

### Fixed

- The account workspace no longer nests a second main landmark inside the app shell.

## [0.1.0] - 2026-11-07

### Added

- IAM setup documentation and contributor and agent instructions for DDD and Git Flow.
- Sign-in, registration, password recovery, and authenticated account workspace screens.
- Firebase authentication, guarded account state, and authenticated IAM REST adapters.
- Shared Angular theme and runtime configuration for API and Firebase setup.
- Initial Angular web application and visual theme.
- Contributor guidance covering Domain-Driven Design, Git Flow, Conventional Commits, Semantic Versioning, and pull request practices.
- Proprietary license notice for the closed-source project.
- Commit message hook and Git Flow pull request checks to enforce branch and Conventional Commits conventions.
- Git mailmap to unify contributor identities.

### Changed

- Grouped IAM pages and reusable presentation components into focused directories.
- Consolidated shared authentication styles and removed duplicate presentation stylesheets.
- Standardized text file line endings across development platforms.
- Updated project dependencies.
- Contribution guide aligned with the team's Git Flow, Conventional Commits and Semantic Versioning conventions.

### Fixed

- Kept registration sessions valid through provisioning and allowed verification-email retries.
- Rejected stale account responses and navigation during session changes, with regression coverage.
- Reused IAM request handling and limited stalled API requests.

### Removed

- Obsolete authentication styles that were no longer referenced by any component.
