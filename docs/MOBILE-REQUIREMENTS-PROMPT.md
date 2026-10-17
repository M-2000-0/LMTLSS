# LMTLSS — Mobile Engineering Prompt Appendix

Paste this section at the end of the LMTLSS master prompt whenever you brief an app builder or coding agent. It converts the product vision into a binding iOS + Android implementation requirement; without it, a builder may reasonably stop at a responsive web prototype.

Companion docs: [PRD.md](PRD.md) · [MOBILE-SPEC.md](MOBILE-SPEC.md)

---

# LMTLSS — iOS and Android Implementation Requirements

## Objective

Implement LMTLSS as a production-minded mobile application for both Apple iOS and Android.

A responsive website or browser-based prototype alone does not satisfy this requirement.

The product must support platform-appropriate navigation, permissions, storage, notifications, background behavior, accessibility, and device integrations.

## 1. Technology

Use React Native and TypeScript for the shared mobile application, with a compatible native build workflow.

Expo with development builds and prebuild may be used where appropriate. Do not assume that every required native capability is available in Expo Go.

Keep platform-specific code isolated behind defined interfaces. Use native modules or platform-specific implementations where necessary.

Maintain strict TypeScript types, modular architecture, reusable design tokens, automated tests, and documented setup instructions.

## 2. Platform parity

Implement and test every core user journey on both iOS and Android.

Required journeys:

- Sign up and sign in.
- Complete onboarding.
- Choose and configure sports.
- Start, pause, resume, and finish a workout.
- Log strength sets and repetitions.
- Record running activities using supported tracking capabilities.
- Recover an interrupted session.
- View activity history and progress.
- Generate and share an activity card.
- Join a club and interact with its content.
- Use the AI coach.
- Configure notifications, privacy, and integrations.
- Export user data and delete an account.

Parity means equivalent core capabilities, not identical operating-system interfaces. Follow each platform's native interaction conventions.

## 3. Offline and interrupted sessions

Training sessions must not depend on a continuously available network connection.

Persist active-session state locally and recover it after app suspension, crashes, or device restarts where technically feasible.

Queue supported activity changes for synchronization when connectivity returns.

Handle duplicate submissions, failed uploads, conflicting updates, and partially synchronized records safely.

Never silently discard completed training data.

For running, clearly distinguish a session that is actively recording GPS from one that is simply tracking elapsed time.

## 4. GPS and background activity

For outdoor running and other supported GPS activities:

- Request location access only when needed.
- Explain the reason for background access.
- Implement platform-compliant background tracking.
- Handle permission denial and revocation.
- Handle battery constraints and temporary loss of GPS.
- Preserve session state during interruptions.
- Validate timestamps, coordinates, and distance calculations.
- Clearly communicate when tracking is degraded or unavailable.

Do not promise uninterrupted background tracking on every device or under every operating-system setting.

## 5. Health and wearable integrations

Implement iOS HealthKit and Android Health Connect integrations where justified by the product and permitted by the relevant platform.

Use explicit user consent, minimum necessary permissions, and transparent synchronization controls.

Define supported data types, import and export behavior, deduplication, data provenance, and conflict resolution.

Never assume an integration provides every metric, wearable feature, or background update.

Add third-party integrations only after verifying API access, licensing, authentication, and technical constraints.

## 6. Notifications

Implement configurable local and push notifications.

Support relevant reminders for:

- Scheduled training.
- Upcoming club sessions.
- Optional progress summaries.
- Requested coaching follow-ups.

Avoid excessive notifications. Honor user preferences, operating-system permissions, and quiet periods where supported.

Do not depend on push notifications for data integrity or critical session persistence.

## 7. Platform-specific interface

Preserve the LMTLSS design system:

- Primary black: `#000000`.
- Primary green: `#61EB1A`.
- Supporting neutral colors only.

Create consistent visual identity while respecting iOS and Android conventions for permissions, system dialogs, navigation, keyboards, accessibility, and sharing.

Test small and large screens, display scaling, safe areas, text resizing, dark appearance, reduced-motion preferences, and screen readers.

## 8. Backend and security

Keep secrets, AI-provider credentials, privileged operations, and protected business logic out of the mobile client.

Implement secure authentication, authorization, server-side validation, database access controls, rate limits, and appropriate encryption.

Use short-lived credentials where appropriate and a secure platform storage mechanism for sensitive tokens.

Implement account deletion, data export, consent records, and clear data-retention policies.

Never log private health information, credentials, or precise routes unnecessarily.

## 9. AI implementation

Expose AI features through controlled backend services.

Use deterministic code for calculations, structured outputs for generated plans, and validation before saving recommendations.

Support timeouts, retries, rate limits, graceful errors, and fallback experiences.

Do not block essential workout logging on AI availability.

Track model usage, latency, error rates, and cost without collecting unnecessary sensitive information.

## 10. Performance and testing

Establish measurable budgets for startup time, screen transitions, workout logging, network requests, and battery consumption.

Test on real iOS and Android devices, including low-connectivity scenarios and background interruptions.

Include:

- Unit tests.
- API and integration tests.
- UI and end-to-end tests.
- Accessibility checks.
- GPS and session-recovery tests.
- Data synchronization tests.
- Security checks.
- Regression tests for both platforms.

Do not treat a successful simulator run as proof of production readiness.

## 11. Release and delivery

Provide:

- The complete mobile source code.
- Reproducible environment setup.
- Development and production build instructions.
- Environment-variable documentation.
- Database migrations and backend configuration.
- Automated test results.
- A feature-by-platform compatibility matrix.
- iOS and Android release build configuration.
- App-store submission preparation.
- Known limitations and unresolved issues.

Use internal testing and beta distribution before public release.

Never label an untested feature as production-ready. Clearly identify any external account, signing certificate, permission, or developer enrollment required from the product owner.

## Acceptance criterion

LMTLSS is not complete merely because it renders on a phone-sized screen.

It must build, run, preserve user data, complete its core workflows, and pass defined tests on both iOS and Android.
