# iOS preparation and verified boundary

Verified 2026-10-05 (Europe/Stockholm). Runtime commit: `ac615569d183f1dc83b957d147008c1710ad27e0`.

GitHub Actions: https://github.com/SirElin8290/DinPuls/actions/runs/37239461875 — SUCCESS.

## Passed

- Normal iOS simulator build, separate from the instrumented test build. Downloaded normal package contains Firebase Messaging and PrivacyInfo.xcprivacy, without e2e-bridge.js.
- Larger iPhone simulator: native status-bar space, module hiding across application restart, password reset invalidating the previous session, single login without the old login screen, five authenticated portal views, native PDF cache write, and isolated registration/activation/password/purchase/signature/banner upload/moderation/public image chain.
- iPhone SE simulator: status-bar space, module hiding across restart, and layout checks.
- Both simulators: lunch, calendar, associations, school/family, practical information, emergency preparedness, company login and association account pages open without horizontal overflow.
- Screenshots inspected: both home screens, public test advertisement, and company login on the small device. System clock/battery no longer overlap app branding.
- Nine local client tests passed. Android regression workflow 37237016181 passed before the subsequent iOS-only layout changes.
- Backend commit `cf6a844c77ef4fddb1dc479fe4d9b9629b63679d` is on main and deployed as Worker version `0728b130-0d34-4ff4-b92b-7dff712d5659`. Native push and automatic push tests passed. Live configuration confirms Android enabled and iOS disabled pending Apple configuration.

## Not claimed / still required

- The account/purchase/banner chain used isolated D1/R2 data and captured email calls. It did not charge a real customer, send real customer mail, or prove inbox delivery.
- No physical iPhone push delivery, keyboard/file-picker/share-sheet verification, signed device build, TestFlight release or App Store approval.
- Register the Firebase iOS app for `se.dinpuls.app` in project `dinpuls-57683`, supply its configuration through the documented secret, and configure APNs credentials. Enable the server iOS gate only after this setup and perform a physical-device delivery test.
- Apple Developer membership/signing and App Store Connect remain required for distribution; no paid service was activated.
- Resolve advertising purchases under App Review Guideline 3.1.3(g), then verify account deletion, privacy declarations, age rating and icon/media rights before submission. Existing web purchase functionality was preserved; it is not represented as App Store compliant.
- The simulator ZIP is for a Mac simulator, not an installable iPhone release.

Artifacts and per-device report.json files are attached to the successful Actions run (seven-day retention). This document preserves the verification boundary after artifact expiry.
