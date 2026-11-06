# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- IAM setup documentation and contributor and agent instructions for DDD and Git Flow.

- Sign-in, registration, password recovery, and authenticated account workspace screens.

- Firebase authentication, guarded account state, and authenticated IAM REST adapters.

- Shared Angular theme and runtime configuration for API and Firebase setup.

- Initial Angular web application and visual theme.
- Contributor guidance covering Domain-Driven Design, Git Flow, Conventional Commits, Semantic Versioning, and pull request practices.
- Proprietary license notice for the closed-source project.

### Changed

- Updated project dependencies.

### Fixed

- Kept registration sessions valid through provisioning and allowed verification-email retries.
- Rejected stale account responses and navigation during session changes, with regression coverage.
- Reused IAM request handling and limited stalled API requests.
