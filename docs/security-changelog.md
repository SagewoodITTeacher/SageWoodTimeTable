# Security Changelog

## 2026-05-07 — Auth & rules hardening

Plan 2 of the UX/UI/security refactor (`docs/superpowers/plans/2026-05-07-plan-02-security-auth.md`).

### What changed

- **Firestore rules now enforce roles via `/users/{uid}.roles`.** The helpers `isAdmin`, `isWebmaster`, `isOperationalManager`, and `isApprover` previously returned `isSignedIn()` regardless of the caller. They now read the caller's user document and check the `roles` array (or `canApproveExtensions` for `isApprover`). `firestore.rules`.
- **Anonymous sign-in disabled.** `FirebaseContext` no longer calls `signInAnonymously` on load. Visitors must complete Google sign-in to reach any panel. `src/context/FirebaseContext.tsx`.
- **Shared password removed.** `App.tsx` no longer accepts `'CURRO'` as a login. `src/App.tsx`.
- **Email-suffix matching fallback removed.** Login no longer guesses among `firstName.lastName@curro.co.za`, `@curro.com`, `staffCode@curro.co.za`. Authentication uses Firebase Auth's email exclusively. `src/App.tsx`.
- **`SUPER_ADMINS` allowlist removed.** Roles are now sourced exclusively from the user's Firestore document. The original list (MERV, PLAL, EZRN, FRAN) is preserved out-of-source at `.local/removed-from-app-tsx-2026-05-07.md` (gitignored) until Plan 9 migrates app config into Firestore. `src/App.tsx`.
- **`handleFirestoreError` no longer logs PII.** The previous `authInfo` block (userId, email, emailVerified, isAnonymous, tenantId, providerInfo) is gone. A new `sanitizeError()` (`src/lib/sanitize-error.ts`) defensively scrubs email-shaped strings and 28-character Firebase UIDs from raw error messages. `src/firebase.ts`.
- **`GEMINI_API_KEY` removed from client bundle define.** The previous `vite.config.ts` define embedded the key into public JS at build time. Future Gemini features must run on a server function — see `README.md` "Adding Gemini features". `vite.config.ts`.
- **`testConnection()` is now dev-only.** Gated by `import.meta.env.DEV`. Production no longer pays an extra round-trip on page load.

### Tests added

- `firestore.rules.test.ts` — 9 rules unit tests covering `isAdmin`, `isWebmaster`, `isOperationalManager`, `isApprover`, role escalation prevention, and anonymous session denial. Run via `npm run test:rules` (uses Firestore emulator).
- `src/lib/sanitize-error.test.ts` — 6 unit tests for the PII scrubber.

### Manual verification still required

The plan's Task 10 lists 10 manual smoke-test rows that need a real Google account + a Firestore project. Operator should run through them before declaring Plan 2 fully verified:

1. Login screen shows only the Google button — no email/password.
2. Cancelling the Google popup leaves no anonymous session in IndexedDB.
3. Signing in with an unprovisioned Google account triggers "not provisioned" error and signs back out.
4. Signing in with a provisioned account loads the role panel.
5. Signed-out console writes to `/venues` are denied (PERMISSION_DENIED).
6. Signed-in non-admin console writes to `/venues` are denied.
7. Manually adding `roles: ['ADMIN']` to a `users/{uid}` doc immediately surfaces the Admin tab on next load.
8. Triggering a Firestore error in the console shows `{ code, operationType, path, message }` only — no email, no UID, no provider data.

### Cross-plan handoffs

- `SUPER_ADMINS`, `APPROVERS`, `PUBLIC_HOLIDAYS` migration into a Firestore `config/main` doc → **Plan 9**.
- `prefers-reduced-motion`, ARIA semantics, table captions → **Plan 8**.
- `tsconfig "strict": true` and removing the 14 `: any` annotations → **Plan 9**.
- Dead `@google/genai` dependency removal → already done in **Plan 1 Task 7**.
