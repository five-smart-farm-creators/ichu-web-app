# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English and Latin American Spanish interface, with a language menu; English is the default and the choice is remembered in this browser.
- Application shell with navigation, ranch selector, role, account menu, and footer for signed-in pages.
- Shared footer with terms and privacy link on public pages, plus a skip link on every page.
- Translated page titles and meta description that follow the selected language.
- Ranch names in navigation and account pages, with a numbered fallback when a ranch has no name.

### Changed

- Sign-in verifies the Firebase identity and then the ICHU account, without a separate backend session request.
- Errors show the message from the ICHU service in the selected language, or a translated fallback.
- Herd advisory requests and decisions use ranch-scoped endpoints.
- Terms and privacy page describes how ICHU handles sign-in, ranch records, browser preferences, and payments.
- Sign-in and account screens use the shared app layout and show no internal account or ranch identifiers.

### Removed

- Direct access grant form for ranch managers; access is granted by reviewing a pending request.

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
