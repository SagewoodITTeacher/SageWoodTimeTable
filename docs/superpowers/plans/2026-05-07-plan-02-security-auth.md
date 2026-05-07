# Security & Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert client-side role theatre into real, server-enforced auth. Eliminate shared-password login and anonymous database write access.

**Architecture:** Real Firebase Google sign-in only. `firestore.rules` reads `/users/{uid}.roles` for every privileged operation. UI role state derives from authenticated user's Firestore doc, not a hardcoded whitelist.

**Tech Stack:** Firebase Auth (Google provider), Firestore Rules v2, @firebase/rules-unit-testing, vitest.

---

## Context

The current state (per `UX_DESIGN_REVIEW.md` §11 and Executive Summary item 3):

- `firestore.rules:29-49` defines `isAdmin()`, `isWebmaster()`, `isOperationalManager()`, `isApprover()` all as `isSignedIn()` — **every authenticated visitor has admin write access** to every collection.
- `FirebaseContext.tsx:18-27` automatically signs every visitor in *anonymously*. Combined with the above, the Firestore database is effectively a public read/write store.
- `App.tsx:46-50` checks `password === 'CURRO'` (a hardcoded shared string) for "login". `App.tsx:14-19` defines a `SUPER_ADMINS` allowlist that overrides DB roles.
- `firebase.ts:51-78` `handleFirestoreError` packs `userId`, `email`, `tenantId`, all linked OAuth providers into a JSON-stringified message, then `console.error`s it AND throws it. PII leaks into browser DevTools and any error-tracking endpoint.
- `vite.config.ts:11` does `JSON.stringify(env.GEMINI_API_KEY)` at build time — the key would be embedded in the public bundle if the dependency were used.

**Pre-requisites this plan assumes:**
- Plan 1 has run, so `vitest` + `@testing-library/react` + `package.json scripts.test` exist. If executing this plan first, install vitest first (see Task 0 below).
- Firebase project ID and existing `users/{uid}` documents exist with a `roles: string[]` field. Verified via `firestore.rules:62-77` (existing `users` collection rules already reference role-shaped data).
- Google as identity provider is already wired (`FirebaseContext.tsx:36`). No additional Firebase Console changes are required for sign-in.
- `firebase` CLI is available. If not, `npm i -g firebase-tools` is the install command.

---

## Files Touched

| Path | Change |
|---|---|
| `firestore.rules` | Replace `isAdmin/isWebmaster/isOperationalManager/isApprover` helpers (lines 29-49). |
| `src/context/FirebaseContext.tsx` | Remove anonymous auto sign-in (lines 18-27). Expose `login()` + `logout()` only. |
| `src/components/Login.tsx` | Strip email/password form, replace with single "Sign in with Google" button. |
| `src/App.tsx` | Delete `SUPER_ADMINS` (lines 14-19), `handleLocalLogin` (lines 46-66), `handleLogout` local-only path (lines 70-73), and the role-override block (lines 78-86). Replace with Firestore-driven role load. |
| `src/firebase.ts` | Sanitize `handleFirestoreError` (lines 51-78) — strip `authInfo`. |
| `vite.config.ts` | Remove `process.env.GEMINI_API_KEY` define (line 11). |
| `firestore.rules.test.ts` | New file: rules unit tests. |
| `package.json` | Add `@firebase/rules-unit-testing` dev dep, add `test:rules` script. |
| `firebase.json` | New file (if absent): minimal Firebase config so emulator can boot rules tests. |

Do **not** touch panel files in this plan. Role-gated UI behavior already keys off `activeUser.roles` via `App.tsx:78-91` — once that block is replaced with Firestore-loaded roles, every panel's existing render logic continues to work.

---

## Task 0: (If Plan 1 hasn't run) Set up vitest

Skip if `package.json scripts.test` already runs vitest.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dev deps**

```bash
npm i -D vitest@^2.1.0 @vitest/ui jsdom @firebase/rules-unit-testing
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

In `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:rules": "firebase emulators:exec --only firestore 'vitest run firestore.rules.test.ts'"
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: vitest runs, exits 0 with "no tests found" or similar; no error thrown.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: scaffold vitest + rules-unit-testing"
```

---

## Task 1: Add Firebase emulator config

The rules tests need the Firestore emulator. Skip if `firebase.json` already declares it.

**Files:**
- Create: `firebase.json` (if missing)
- Create: `.firebaserc` (if missing)

- [ ] **Step 1: Inspect**

Run: `ls /home/leon/dev/github/curro/firebase.json 2>/dev/null && echo present || echo missing`

If present, open it and verify it has an `emulators.firestore.port` key. If yes, skip to Task 2.

- [ ] **Step 2: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": false
    },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 3: Create `.firebaserc`**

Read `firebase-applet-config.json:projectId` first (e.g. `curro-applet`). Replace `<project-id>` below.

```json
{
  "projects": {
    "default": "<project-id>"
  }
}
```

- [ ] **Step 4: Verify emulator boots**

Run: `npx firebase emulators:start --only firestore,auth --project demo-curro &`
Wait 5 seconds.
Run: `curl -s http://localhost:8080`
Expected: response containing "Ok" or 404 — confirms port is bound.
Stop: `kill %1`

- [ ] **Step 5: Commit**

```bash
git add firebase.json .firebaserc
git commit -m "chore: add firebase emulator config"
```

---

## Task 2: Write failing rules test for `isAdmin` reading `/users/{uid}.roles`

**Files:**
- Create: `firestore.rules.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// firestore.rules.test.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc, getDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-curro',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedUser(uid: string, roles: string[]) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}`), {
      id: uid,
      firstName: 'T',
      lastName: 'Test',
      roles,
    });
  });
}

describe('isAdmin', () => {
  it('admin can write venues', async () => {
    await seedUser('admin1', ['ADMIN']);
    const ctx = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'venues/v1'), {
        id: 'v1', name: 'Hall A', type: 'Hall', capacity: 100,
      })
    );
  });

  it('non-admin cannot write venues', async () => {
    await seedUser('teacher1', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('teacher1').firestore();
    await assertFails(
      setDoc(doc(ctx, 'venues/v2'), {
        id: 'v2', name: 'Hall B', type: 'Hall', capacity: 100,
      })
    );
  });

  it('signed-in but no user doc cannot write venues', async () => {
    const ctx = testEnv.authenticatedContext('ghost').firestore();
    await assertFails(
      setDoc(doc(ctx, 'venues/v3'), {
        id: 'v3', name: 'Hall C', type: 'Hall', capacity: 100,
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules`

Expected: Two tests fail. Specifically `'non-admin cannot write venues'` and `'signed-in but no user doc cannot write venues'` will both pass when they should fail (they currently `assertSucceeds` because the live rules grant any signed-in user write). The `'admin can write venues'` test will succeed (false positive — it's not actually checking roles yet).

Output should contain: `2 failed`.

- [ ] **Step 3: Commit (red)**

```bash
git add firestore.rules.test.ts package.json package-lock.json
git commit -m "test: add failing rules tests for isAdmin role enforcement"
```

---

## Task 3: Replace `isAdmin/isWebmaster/isOperationalManager/isApprover` to read `/users/{uid}.roles`

**Files:**
- Modify: `firestore.rules:29-49`

- [ ] **Step 1: Replace helper block**

Replace `firestore.rules` lines 14 through 49 (the `isOwner`, `isAuthorized`, `isAdmin`, `isWebmaster`, `isOperationalManager`, `isApprover` definitions) with this exact block:

```
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function userDoc() {
      // Reads the caller's user profile. Returns null if the doc doesn't exist.
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function hasRole(role) {
      return isSignedIn()
          && exists(/databases/$(database)/documents/users/$(request.auth.uid))
          && (role in userDoc().data.roles);
    }

    function isAdmin()              { return hasRole('ADMIN'); }
    function isWebmaster()          { return hasRole('WEBMASTER'); }
    function isOperationalManager() { return hasRole('OPERATIONAL_MANAGER'); }
    function isApprover() {
      return isSignedIn()
          && exists(/databases/$(database)/documents/users/$(request.auth.uid))
          && userDoc().data.canApproveExtensions == true;
    }

    function isAuthorized() {
      // Legacy alias — anything calling this should migrate to a specific role.
      // Kept narrow for now so existing call sites keep working.
      return isSignedIn();
    }
```

Important: `isAuthorized()` is referenced from old `isAdmin/isWebmaster/isOperationalManager/isApprover` — but those are now overridden, so the alias is now used only where `isAuthorized()` itself was directly invoked. Search the file for `isAuthorized()` calls:

Run: `grep -n 'isAuthorized()' firestore.rules`

Expected: Only the helper definitions reference it; no direct call sites remain. If any do (e.g. `match /helpRequests`), they should be left as `isSignedIn()`-equivalent — that is correct semantics for those paths (any signed-in teacher can create a help request for themselves).

- [ ] **Step 2: Confirm rule comments are no longer misleading**

Replace the comment block at `firestore.rules:17-19` ("Since the user wants a custom login...") with:

```
    // Roles are enforced server-side via the user's /users/{uid}.roles array.
    // Anonymous auth is no longer permitted; sign-in is via Firebase Auth Google provider.
```

- [ ] **Step 3: Run rule tests**

Run: `npm run test:rules`

Expected: All three `isAdmin` tests in Task 2 now pass. Output: `3 passed`.

If `'admin can write venues'` fails, double-check that `seedUser` puts `roles: ['ADMIN']` exactly (uppercase). Inspect via the emulator UI.

- [ ] **Step 4: Commit (green)**

```bash
git add firestore.rules
git commit -m "fix(rules): enforce roles via /users/{uid}.roles instead of isSignedIn"
```

---

## Task 4: Add rule tests for the remaining role helpers

**Files:**
- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Append tests**

Append to `firestore.rules.test.ts`:

```ts
describe('isWebmaster', () => {
  it('webmaster can write subjects', async () => {
    await seedUser('wm1', ['WEBMASTER']);
    const ctx = testEnv.authenticatedContext('wm1').firestore();
    // Subject write is `isAdmin()` per current rules; if you intend Webmaster to
    // also have it, update the rule. This test documents current intent.
    await assertFails(
      setDoc(doc(ctx, 'subjects/s1'), { code: 'X', name: 'X' })
    );
  });
});

describe('isOperationalManager', () => {
  it('OM can create marking extensions', async () => {
    await seedUser('om1', ['OPERATIONAL_MANAGER']);
    const ctx = testEnv.authenticatedContext('om1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'markingExtensions/m1'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 'om1',
      })
    );
  });

  it('Teacher cannot create marking extensions', async () => {
    await seedUser('t1', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('t1').firestore();
    await assertFails(
      setDoc(doc(ctx, 'markingExtensions/m2'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 't1',
      })
    );
  });
});

describe('isApprover', () => {
  it('approver can update marking extension', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/ap1'), {
        id: 'ap1', firstName: 'A', lastName: 'P',
        roles: ['OPERATIONAL_MANAGER'], canApproveExtensions: true,
      });
      await setDoc(doc(ctx.firestore(), 'markingExtensions/m3'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 'ap1',
      });
    });
    const ctx = testEnv.authenticatedContext('ap1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'markingExtensions/m3'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'APPROVED', additionalGreenDays: 2, requestedBy: 'ap1',
      })
    );
  });
});

describe('role escalation', () => {
  it('non-admin cannot grant themselves ADMIN role', async () => {
    await seedUser('victim', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('victim').firestore();
    await assertFails(
      setDoc(doc(ctx, 'users/victim'), {
        id: 'victim', firstName: 'T', lastName: 'Test', roles: ['ADMIN'],
      })
    );
  });
});

describe('anonymous session', () => {
  it('anonymous (no auth) cannot read users', async () => {
    const ctx = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(ctx, 'users/anyone')));
  });
});
```

- [ ] **Step 2: Run**

Run: `npm run test:rules`

Expected: All tests in this and Task 2 pass. Output: `9 passed` (or whatever total).

- [ ] **Step 3: Commit**

```bash
git add firestore.rules.test.ts
git commit -m "test: cover Webmaster/OM/Approver role helpers and escalation"
```

---

## Task 5: Remove anonymous auto sign-in from `FirebaseContext`

**Files:**
- Modify: `src/context/FirebaseContext.tsx:18-35`

- [ ] **Step 1: Replace the `useEffect`**

Replace lines 18-35 (the `useEffect` block) with:

```tsx
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
```

Also remove `signInAnonymously` from the import on line 3:

```tsx
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No new errors. If `signInAnonymously` is referenced elsewhere, the compiler will flag it. Search:

Run: `grep -rn 'signInAnonymously' src/`

Expected: Zero matches.

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`
Open http://localhost:3000.
Open DevTools → Application → IndexedDB → firebaseLocalStorageDb. Confirm no anonymous user is created on initial load (the `auth.currentUser` should be null until you click Sign In).

- [ ] **Step 4: Commit**

```bash
git add src/context/FirebaseContext.tsx
git commit -m "fix(auth): stop signing visitors in anonymously"
```

---

## Task 6: Replace `Login.tsx` with Google sign-in

**Files:**
- Modify: `src/components/Login.tsx` (87 lines → ~50 lines)

- [ ] **Step 1: Replace file content**

Overwrite `src/components/Login.tsx` with:

```tsx
import React from 'react';
import { LayoutDashboard, LogIn, AlertCircle } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

interface LoginProps {
  error?: string | null;
  onError?: (msg: string) => void;
}

export default function Login({ error, onError }: LoginProps) {
  const { login } = useFirebase();
  const [busy, setBusy] = React.useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await login();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed.';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-gray-50 to-white">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl shadow-blue-900/10 border border-white flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-500/20 rotate-3 border-b-4 border-red-600">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight italic uppercase">Curro Hub</h1>
          <p className="text-gray-500 font-medium leading-relaxed">
            Invigilation Management System <br/>
            <span className="text-xs uppercase tracking-widest text-blue-600 font-black">Staff Authentication</span>
          </p>
        </div>

        {error && (
          <div role="alert" className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white rounded-2xl py-4 font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-wait"
        >
          <LogIn className="w-5 h-5" />
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          Curro South Africa • Authorized Staff Only
        </p>
      </div>
    </div>
  );
}
```

Notes:
- Removed: `useState` for email/password, `Mail`/`Lock` icons, the `<form>`, both `<input>`s, `animate-shake` class.
- Kept: same visual envelope (logo, headings, footer, gradient background) so the surface area of visual change is minimal — this is intentional, restyling is Plan 7.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`

Expected: One error in `App.tsx` because `<Login onLogin={handleLocalLogin} />` no longer matches the new prop signature. That's the next task.

- [ ] **Step 3: Don't commit yet**

Tasks 6 and 7 are paired. Commit after Task 7.

---

## Task 7: Wire `App.tsx` to Firebase Auth, delete shared password, delete `SUPER_ADMINS`

**Files:**
- Modify: `src/App.tsx:1-100`

- [ ] **Step 1: Replace imports and the top of the file**

Replace `src/App.tsx` lines 1-100 with:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Teacher, Role, ExamSession, Assignment, LeaveRequest, TimetableEntry, Venue, MarkingExtension, Subject, DayPeriodConfig } from './types';
import { INITIAL_TEACHERS, MOCK_SESSIONS } from './data';
import TeacherDashboard from './components/TeacherDashboard';
import AdminPanel from './components/AdminPanel';
import WebmasterPanel from './components/WebmasterPanel';
import OperationalManager from './components/OperationalManager';
import Login from './components/Login';
import { User as UserIcon, Shield, Briefcase, RefreshCw, LayoutDashboard, LogIn, LogOut, BarChart2 } from 'lucide-react';
import { useFirebase } from './context/FirebaseContext';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';

export default function App() {
  const { user: authUser, loading: authLoading, login: googleLogin, logout: googleLogout } = useFirebase();
  const [activeUser, setActiveUser] = useState<Teacher | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [sessions, setSessions] = useState<ExamSession[]>(MOCK_SESSIONS);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [markingExtensions, setMarkingExtensions] = useState<MarkingExtension[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [dayPeriodConfigs, setDayPeriodConfigs] = useState<DayPeriodConfig[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);

  // Load the user's Firestore profile when authentication completes.
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setActiveUser(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', authUser.uid));
        if (!snap.exists()) {
          setLoginError(
            'Your account is not provisioned. Contact a Curro administrator to be added.'
          );
          await googleLogout();
          setActiveUser(null);
          return;
        }
        const data = snap.data() as Teacher;
        const teacher: Teacher = {
          ...data,
          id: data.id ?? authUser.uid,
          email: data.email ?? authUser.email ?? '',
          roles: Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : ['TEACHER'],
          activeRole: data.activeRole && (data.roles ?? []).includes(data.activeRole)
            ? data.activeRole
            : (data.roles?.[0] ?? 'TEACHER'),
        };
        setActiveUser(teacher);
        setLoginError(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${authUser.uid}`);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [authUser, authLoading, googleLogout]);

  const handleLogout = async () => {
    setActiveUser(null);
    setLoginError(null);
    await googleLogout();
  };

  const switchRole = (role: Role) => {
    if (activeUser?.roles.includes(role)) {
      setActiveUser({ ...activeUser, activeRole: role });
      // Persist active role to Firestore so it survives reload.
      setDoc(doc(db, 'users', activeUser.id), { activeRole: role }, { merge: true })
        .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `users/${activeUser.id}`));
    }
  };
```

Critical deletions vs current state:
- Lines 14-19: `SUPER_ADMINS` array — gone.
- Lines 39-45: localStorage session restore — gone (Firebase Auth persists itself).
- Lines 46-66: `handleLocalLogin` — gone.
- Lines 70-73: localStorage logout — replaced.
- Lines 78-86: role-override block — gone. Roles come from Firestore.
- The `localUser` state is renamed to `activeUser` (was the same value modulo the override).

- [ ] **Step 2: Update `<Login />` invocation**

Find `<Login onLogin={handleLocalLogin} ... />` (was around `App.tsx:240` in old file). Replace with:

```tsx
{authLoading || profileLoading ? (
  <FullPageSpinner />
) : !authUser || !activeUser ? (
  <Login error={loginError} onError={setLoginError} />
) : (
  // ... existing role-panel switch (unchanged)
)}
```

If `FullPageSpinner` doesn't exist as a component, inline:

```tsx
<div className="min-h-screen flex items-center justify-center bg-bg-gray">
  <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
</div>
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`

Expected: 0 errors.

If errors remain, they will be on references to `localUser` further down `App.tsx`. Replace each `localUser` with `activeUser`. Keep going until tsc is clean.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`

1. Open http://localhost:3000 in incognito → see Sign in with Google button (no email/password fields).
2. Click → complete Google flow.
3. If your account has a `users/{uid}` doc → app loads with your role.
4. If not → see "Your account is not provisioned" error, signed out.
5. Click Sign Out → returns to login screen.

- [ ] **Step 5: Commit**

```bash
git add src/components/Login.tsx src/App.tsx
git commit -m "feat(auth): replace shared-password login with Firebase Google sign-in"
```

---

## Task 8: Sanitize `handleFirestoreError` — strip PII

**Files:**
- Modify: `src/firebase.ts:25-78`

- [ ] **Step 1: Replace the function and types**

Replace lines 25-78 with:

```ts
async function testConnection() {
  if (!import.meta.env.DEV) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client appears offline. Check Firebase config.');
    }
  }
}

testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  code: string;
  operationType: OperationType;
  path: string | null;
  message: string;
}

const SAFE_ERROR_KEYS = ['code', 'name', 'message'] as const;

function sanitize(error: unknown) {
  if (!(error instanceof Error)) return { code: 'unknown', message: String(error) };
  const code = (error as { code?: string }).code ?? 'unknown';
  const message = error.message
    // Defensive: strip anything that looks like an email or 28-char Firebase UID
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted-email]')
    .replace(/\b[A-Za-z0-9]{28}\b/g, '[redacted-uid]');
  return { code, message };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const { code, message } = sanitize(error);
  const errInfo: FirestoreErrorInfo = { code, operationType, path, message };
  // eslint-disable-next-line no-console
  console.error('Firestore Error:', errInfo);
  throw new Error(JSON.stringify(errInfo));
}
```

Critical changes:
- Removed the entire `authInfo` block (was lines 39-58 in old file). No `userId`, `email`, `tenantId`, or provider data is logged.
- Added `sanitize()` to scrub email-shaped strings and 28-char UIDs from the message that the underlying SDK might emit.
- Made `handleFirestoreError` return `never` (it always throws). Callers were treating it as throwing already.
- Guarded `testConnection()` with `import.meta.env.DEV` (this also satisfies one Plan 5 task — see Plan 5 Task 5).

- [ ] **Step 2: Audit callers**

Run: `grep -rn 'handleFirestoreError' src/`

Expected: All callers have shape `handleFirestoreError(error, OperationType.X, 'path')`. None pass extra `authInfo`. If any do, remove that arg.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`

Expected: 0 errors.

- [ ] **Step 4: Test the sanitizer**

Create `src/firebase.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Importing handleFirestoreError pulls Firebase init; isolate the sanitize logic
// by re-implementing or by extracting it. For now, we import and exercise via the
// thrown Error message.

describe('handleFirestoreError', () => {
  it('strips email addresses from error messages', async () => {
    const mod = await import('./firebase');
    const err = new Error('Permission denied for user alice@curro.co.za on path users/x');
    expect(() => mod.handleFirestoreError(err, mod.OperationType.GET, 'users/x'))
      .toThrowError(/\[redacted-email\]/);
  });

  it('strips 28-char UIDs from error messages', async () => {
    const mod = await import('./firebase');
    const err = new Error('User AbCdEfGhIjKlMnOpQrStUvWxYz12 not authorized');
    expect(() => mod.handleFirestoreError(err, mod.OperationType.GET, 'x'))
      .toThrowError(/\[redacted-uid\]/);
  });

  it('does not include authInfo', async () => {
    const mod = await import('./firebase');
    const err = new Error('Boom');
    try {
      mod.handleFirestoreError(err, mod.OperationType.GET, 'x');
    } catch (thrown) {
      expect(String(thrown)).not.toContain('authInfo');
      expect(String(thrown)).not.toContain('providerInfo');
    }
  });
});
```

- [ ] **Step 5: Run**

Run: `npm test src/firebase.test.ts`

Expected: 3 passed.

If `firebase.ts` initialization barfs in jsdom (it might — `getApps()` etc.), wrap the import in `vi.mock('./firebase', async (importOriginal) => importOriginal())` or extract `sanitize` into a separate file `src/lib/sanitize-error.ts` and test that pure function. Choose the latter if Firebase init is intrusive.

- [ ] **Step 6: Commit**

```bash
git add src/firebase.ts src/firebase.test.ts
git commit -m "fix(security): strip PII from Firestore error logs"
```

---

## Task 9: Remove `GEMINI_API_KEY` define from Vite config

**Files:**
- Modify: `vite.config.ts:8-12`

- [ ] **Step 1: Verify the key is unused**

Run: `grep -rn 'GEMINI_API_KEY\|GoogleGenAI\|@google/genai' src/`

Expected: 0 matches. (`@google/genai` is in `package.json` per `UX_DESIGN_REVIEW.md` §11 but unused.)

If matches exist (someone added Gemini between sessions), pause and consult — this plan assumes unused.

- [ ] **Step 2: Remove the define**

In `vite.config.ts`, delete lines 8-10:

```diff
-    define: {
-      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
-    },
```

The remaining config keeps `loadEnv` only if needed — but with the define gone, `loadEnv` is also unused. Remove it too. Final file:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
```

- [ ] **Step 3: Verify build still works**

Run: `npm run build`

Expected: Build succeeds, no warnings about missing `process.env.GEMINI_API_KEY`. Inspect `dist/assets/*.js` and grep for `GEMINI` — should be 0.

Run: `grep -r 'GEMINI' dist/ 2>/dev/null`
Expected: empty.

- [ ] **Step 4: Document the future-Gemini path**

Append to `README.md` (or create a new `docs/gemini-integration.md`):

```md
## Adding Gemini features

Do NOT add `GEMINI_API_KEY` to the client bundle. The previous `vite.config.ts`
define caused the key to be embedded in the public JS. If a Gemini feature is
needed:

1. Create a Firebase Cloud Function (or other server endpoint).
2. Function reads `process.env.GEMINI_API_KEY` at runtime — never inlined.
3. Client calls the function via `httpsCallable` with the user's ID token.
4. Server validates the user's role from the token before forwarding the prompt.
```

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts README.md
git commit -m "fix(security): remove GEMINI_API_KEY from client bundle define"
```

---

## Task 10: End-to-end manual verification

This is not a code task; it's a smoke checklist.

- [ ] **Step 1: Restart**

Run: `npm run build && npm run preview`

- [ ] **Step 2: Verify (use the table)**

| Action | Expected |
|---|---|
| Visit `/` in incognito | Login screen with one Google button. No email/password fields. |
| Open DevTools → Network → click Sign In | Popup opens to accounts.google.com. |
| Cancel popup | Back to login screen. No anonymous user created. |
| DevTools → Application → IndexedDB → firebaseLocalStorageDb | Empty. |
| Sign in with a Google account that has no `users/{uid}` doc | Brief load, then login screen with "not provisioned" error. Auto-signed-out. |
| Sign in with a provisioned account (`roles: ['TEACHER']`) | Teacher dashboard loads. Network tab: `users/{uid}` GET succeeds. |
| In another browser tab, attempt Firestore write while signed-out: `firebase.firestore().collection('venues').add({ ... })` from the console of the same origin | PERMISSION_DENIED. (Without auth, no user doc, no role.) |
| Sign in as a teacher and attempt to add a venue from the console | PERMISSION_DENIED. |
| In Firebase Console → Firestore → manually create a doc `users/<your-uid>` with `roles: ['ADMIN']` | Refresh the app → Admin tab appears. |
| Trigger an error in DevTools (e.g. write to `/sessions/x` as a non-admin) | Console shows `Firestore Error: { code, operationType, path, message }`. No email, no UID. |

- [ ] **Step 3: Build check no Gemini key**

Run: `find dist -name '*.js' -exec grep -l 'GEMINI\|generativelanguage' {} \;`
Expected: empty.

- [ ] **Step 4: Commit verification log**

If you keep a release log: add a row to `docs/security-changelog.md` or create one:

```md
# Security Changelog

## 2026-05-07 — Auth & rules hardening

- Firestore rules now enforce roles via `/users/{uid}.roles`.
- Anonymous sign-in disabled; Google sign-in is the only path.
- `SUPER_ADMINS` allowlist removed; roles are DB-driven.
- `handleFirestoreError` no longer logs PII.
- `GEMINI_API_KEY` removed from client bundle define.
```

```bash
git add docs/security-changelog.md
git commit -m "docs: log security hardening pass"
```

---

## Self-Review Checklist (run before declaring complete)

- [ ] All 9 (or 10 with Task 0) tasks marked done.
- [ ] `grep -rn 'isAuthorized()' firestore.rules` returns only the helper definitions and any explicit fall-throughs you intend.
- [ ] `grep -rn 'signInAnonymously' src/` returns 0.
- [ ] `grep -rn "password === 'CURRO'" src/` returns 0.
- [ ] `grep -rn 'SUPER_ADMINS' src/` returns 0.
- [ ] `grep -rn 'authInfo\|providerInfo' src/firebase.ts` returns 0.
- [ ] `grep -r 'GEMINI' dist/ 2>/dev/null` returns 0 after `npm run build`.
- [ ] `npm run test:rules` is green.
- [ ] `npm test` (the sanitize tests) is green.
- [ ] Manual checklist (Task 10 Step 2) all rows pass.

## Out of scope (handled in other plans)

- Removing `@google/genai` dep itself: Plan 1 task 7.
- Replacing `lint: tsc --noEmit` with real eslint: Plan 1 task 8.
- Inline error UI replacing `alert('Failed to ...')`: Plan 4.
- Self-hosting the help-notification audio: Plan 5 task 6.
- `tsconfig strict` and fixing `: any`: Plan 9.
- `SUPER_ADMINS`/`APPROVERS`/`PUBLIC_HOLIDAYS` migration to Firestore config: Plan 9 (this plan only deletes `SUPER_ADMINS` because real auth makes it irrelevant).
