# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Heart rate of each animal in the latest values, the readings, the statistics, a chart against its normal range, the herd monitoring table, the clinical history, the Excel and PDF exports, the normal ranges and the alerts.
- Methane index of each animal in the latest values, the readings, the statistics, a chart and the exports, labelled as a relative index rather than ppm.
- Water trough status in the water troughs list: the latest water temperature with its capture time, the range status against the band, the controller communication and the heater state, and a 24-hour history with a chart against the band and a table; the Excel and PDF exports include the new columns.
- Methane alerts raised from the methane index, shown in the alerts queue, the alert detail and the dashboard.
- Warning and Critical normal ranges per productive stage and metric; a Critical range must contain its Warning range, and the charts and statistics measure against the Warning range.

### Fixed

- Nutrition plans, planned activities and planning campaigns call the routes that the ICHU service now serves, which no longer include the ranch in the path of a lot, activity or campaign.

## [0.2.0] - 2026-11-13

### Added

- Dark theme with a toggle in the top bar and on the public pages; the choice is remembered on the device.
- Firebase Hosting configuration and a deployment script that publishes the build with the production runtime configuration instead of the local one.
- Reproduction screen for each female, with the breeding services, pregnancy diagnoses, calvings, abortions and heats in a timeline newest first, the calving intervals with the days open after each calving, confirmed pregnancies, services per pregnancy, the expected calving date of a pregnancy in progress, and Excel and PDF downloads.
- Breeding services, pregnancy diagnoses, calvings, abortions and heats are recorded from the reproduction screen and the clinical history, with the sire, the pregnancy result and the expected calving date; only females take reproductive records, and the dialog offers the types that the account may register.
- Clinical history timeline shows the sire, the pregnancy result and the expected calving date of each record.
- Nutrition plan screen for each lot, with the plan in force, its feed per head and the estimated daily feed of the lot, the target daily gain, the plan history with ration change markers, and the rumination of the lot before and after the latest ration change in a chart.
- Nutrition plan registration for managers, with several feeds per ration, a target daily gain and an optional end date; an overlap with another plan shows the message of the ICHU service.
- Nutrition and Reproduction entries in the navigation menu, after Health planning.
- Plan comparison with the annual price of each plan for a head count, quoted by the ICHU service; a plan recommended for the herd, its device limit and its features, with a comparison table for screen readers.
- Subscription request for ranch managers: a confirmation with the quoted amounts and the Terms of Service version, then the hosted Stripe Checkout page. A retry after a failed step reuses the same request.
- My plan screen with the status, validity, amounts, device limit and features of the ranch subscription, payment of a pending subscription, and cancellation with a reason.
- Payment return pages: the success page waits for the plan to become active and explains how to check it later; the cancelled page confirms that nothing was charged and offers a retry.
- Password change on the account page, which checks the current password before it changes it.
- Terms of Service page shows its version.
- Plans and My plan entries in the navigation menu for roles with a ranch, except veterinarians.
- Plan prices read per smart collar: the collars with their unit price and one-time amount, the plan's annual fee, and the total, on the plan cards, the confirmation, and My plan.
- Receipt PDF for a paid subscription and quote PDF for a pending one, downloadable from My plan and from the payment success page; they show the ranch, plan, payment dates, and terms version, never internal identifiers.
- The plans page asks for the number of collars and shows a banner when the ranch already has a pending or active subscription, which disables the Subscribe buttons.
- My herd dashboard as the home page: monitored animals, open alerts by type with a link to alerts, animals outside the grazing zone, mortality rate, births and confirmed pregnancies, each with its calculation on request; a missing indicator reads "Not available" with its reason, never as zero. It also shows the coverage of readings, the work scheduled in the next 7 days, a period of 7, 30, 90 or 365 days or a custom range, and Excel and PDF downloads of the indicator table.
- Reports screen with lot trends: the daily lot mean with a band of standard deviations, the flagged animals by ear tag, and the comparison of one animal with its lot.
- Epidemiological curve for the alert conditions: new cases per day with a 7-day moving average, cumulative cases, peak day, days without new cases, an attack rate when the herd size is known, and a hint about lifting restrictions.
- Executive report with a preview of the indicators and downloads in CSV, PDF and Excel.
- Portfolio of advised ranches for veterinarians, ordered by critical, warning and informative alerts, with a button that opens the dashboard of each ranch, and Excel and PDF downloads.
- Reports entry in the navigation menu for every role with a ranch, and Portfolio entry for veterinarians.
- Compare with lot link on the animal monitoring page, which opens the trend comparison of that animal.
- Charts of the reports with a textual summary for screen readers and a button that shows their data as a table.
- Clinical history screen for each animal, with an animal picker, a 90-day, one-year or five-year period, a type filter, a timeline of field events and clinical interventions newest first, a health summary with the latest values, pending alerts and the current withdrawal period, Excel and PDF downloads, and registration of health events (managers) and clinical interventions (veterinarians with clinical access). Registering a record again after a failed attempt does not create a duplicate.
- Health planning screen with a month calendar, a day list, an agenda view, reminders for the next 7 days and for overdue work, and Excel and PDF downloads of the visible month.
- Planning campaigns, sanitary or reproductive, over an inclusive range of days, with their scheduled activities, applications linked to a clinical intervention of the same animal, and follow-ups; Excel and PDF downloads.
- Withdrawal periods per animal with their bounds, state and days left, filtered by animal, recorded with explicit start and end instants.
- Clinical history and Health planning entries in the navigation menu, and links to the clinical history from the animal profile and the animal monitoring page.
- Herd monitoring with the latest body temperature, activity, rumination and last known position of each active animal, a lot filter, stale and missing values labelled instead of shown as zero, and Excel and PDF downloads.
- Animal monitoring with latest values, a 24-hour, 7-day, 30-day or custom period, charts with the threshold band, statistics (valid readings, minimum, maximum, average, standard deviation and share outside the threshold), a readings table, and Excel and PDF downloads.
- Normal ranges per productive stage and metric, with a table and a dialog to configure them; a range requires a minimum below its maximum.
- Alerts queue with status and animal filters, paging, severity and status badges, a detail drawer with values against their thresholds or the grazing zone, and attention given with a finding and an optional action.
- Location and fences screen: grazing zones drawn on OpenStreetMap with Leaflet, where map clicks add corners, dragging moves them, and clicking a corner (or pressing Enter on it) removes it; also redefinition and the last known position of each active animal, with tables that list the same data.
- Location & fences, Monitoring and Alerts entries in the navigation menu, and a Monitoring link on the animal profile.
- Map without an API key: Leaflet with OpenStreetMap tiles, loaded only when the location screen opens; if it cannot load, the screen still shows its tables and a notice.
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

- New visual design: pasture green and ichu straw palette, pill buttons, larger cards, and a dark sidebar whose links are grouped into Herd, Health, Production and Account.
- Dialogs fade and rise in and out, pages cross-fade on navigation, and cards appear in sequence; with reduced motion the app only fades.
- The dashboard shows a body temperature chart per lot with its ±1σ band and alert threshold, the recent alerts and the collar connectivity beside the indicators, and the period is chosen with chips.
- Signed-in users land on My herd after sign-in, from the root address, and from the not-found and terms links; the brand opens My herd.
- Account and advisories are separate pages: the account page shows identity, ranch access, and the professional profile; the advisories page handles access requests and decisions.
- Professional profile changes are checked for specialty, license number, and years of experience before saving.
- Granted access ends at the close of the selected day in local time.
- Sign-in verifies the Firebase identity and then the ICHU account, without a separate backend session request.
- Errors show the message from the ICHU service in the selected language, or a translated fallback.
- Herd advisory requests and decisions use ranch-scoped endpoints.
- Terms and privacy page describes how ICHU handles sign-in, ranch records, browser preferences, and payments.
- Sign-in and account screens use the shared app layout and show no internal account or ranch identifiers.
- Firebase Authentication loads on first use, so the initial download of the app is smaller.
- Pull requests to develop and main run the typecheck, the production build, and the unit tests in continuous integration.

### Removed

- Direct access grant form for ranch managers; access is granted by reviewing a pending request.
- Ranch ID entry for access requests; veterinarians enter the ranch access code instead.
- The combined account workspace page; its content moved to the account and advisories pages.

### Fixed

- Veterinarians can register again: the hidden head-count field no longer blocks the form when the account is not a ranch manager.
- Every route of the deployed site revalidates its page on each visit, so visitors get a new release at once instead of a cached page for up to an hour.
- The map draws on the deployed site; the production bundle exposed Leaflet only as its default export.
- Sign-in and sign-up wait for a sleeping API to start: the app wakes it on load, allows 60 s per request and explains a slow start.
- The account workspace no longer nests a second main landmark inside the app shell.
- Counts show the singular for one in English and Spanish, so one animal, event, case, day, or collar never reads with a plural word.
- Date picker controls, such as Open calendar and the month and year navigation, follow the selected language.
- The Spanish message for lots without trends uses the same informal address as the rest of the interface.

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
