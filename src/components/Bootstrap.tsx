import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Role } from '../types';

const ALL_ROLES: Role[] = ['ADMIN', 'WEBMASTER', 'TEACHER', 'OPERATIONAL_MANAGER'];

type Phase = 'SIGNED_OUT' | 'SIGNED_IN' | 'WRITING' | 'DONE' | 'ERROR';

const Bootstrap: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [existingDoc, setExistingDoc] = useState<Record<string, unknown> | null>(null);
  const [phase, setPhase] = useState<Phase>('SIGNED_OUT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [shortId, setShortId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>(['ADMIN', 'TEACHER']);
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setPhase('SIGNED_OUT');
        setExistingDoc(null);
        return;
      }
      setPhase('SIGNED_IN');
      const display = u.displayName?.split(' ') ?? [];
      setFirstName((prev) => prev || display[0] || '');
      setLastName((prev) => prev || display.slice(1).join(' ') || '');
      setEmail((prev) => prev || u.email || '');
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setExistingDoc(data);
          if (typeof data.id === 'string') {setShortId((p) => p || data.id);}
          if (typeof data.firstName === 'string') {setFirstName(data.firstName);}
          if (typeof data.lastName === 'string') {setLastName(data.lastName);}
          if (typeof data.email === 'string') {setEmail(data.email);}
          if (Array.isArray(data.roles) && data.roles.length > 0) {
            setRoles(data.roles as Role[]);
          }
          if (typeof data.activeRole === 'string') {
            setActiveRole(data.activeRole as Role);
          }
        } else {
          setExistingDoc(null);
        }
      } catch (e) {
        setExistingDoc(null);
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setPhase('SIGNED_OUT');
  };

  const toggleRole = (r: Role) => {
    setRoles((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      if (next.length > 0 && !next.includes(activeRole)) {
        setActiveRole(next[0]);
      }
      return next;
    });
  };

  const ready = !!user
    && shortId.trim().length > 0
    && firstName.trim().length > 0
    && lastName.trim().length > 0
    && roles.length > 0
    && roles.includes(activeRole);

  const handleSubmit = async () => {
    if (!user || !ready) {return;}
    setPhase('WRITING');
    setErrorMsg(null);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          id: shortId.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          roles,
          activeRole,
          uid: user.uid,
          totalHours: typeof existingDoc?.totalHours === 'number' ? existingDoc.totalHours : 0,
        },
        { merge: true },
      );
      setPhase('DONE');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('ERROR');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6 flex items-start justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow p-6 space-y-5">
        <header className="border-b pb-3">
          <h1 className="text-2xl font-bold">Curro — User Bootstrap</h1>
          <p className="text-sm text-slate-600 mt-1">
            Local-only tool. Signs you in with Google, then writes a document at
            <code className="mx-1 px-1 bg-slate-100 rounded">users/&#123;your-uid&#125;</code>
            so you can log into the main app.
          </p>
        </header>

        {authLoading && <p>Loading…</p>}

        {!authLoading && !user && (
          <div className="space-y-3 bg-amber-50 border border-amber-300 rounded p-4">
            <p className="font-semibold">Not signed in.</p>
            <p className="text-sm">
              This page reuses the Firebase Auth session from the main app. Sign in
              there first, then return to this tab.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Open main app to sign in &rarr;
            </a>
            <p className="text-xs text-slate-600">
              After you complete sign-in there, come back to this tab and reload.
            </p>
          </div>
        )}

        {user && (
          <>
            <section className="bg-slate-50 border rounded-lg p-4 text-sm space-y-1">
              <div><span className="font-semibold">Signed in as:</span> {user.displayName ?? '(no name)'}</div>
              <div><span className="font-semibold">Email:</span> {user.email ?? '(none)'}</div>
              <div className="break-all"><span className="font-semibold">UID:</span> <code>{user.uid}</code></div>
              <div>
                <span className="font-semibold">Existing user doc:</span>{' '}
                {existingDoc ? (
                  <span className="text-amber-700">Found — submit will MERGE updates.</span>
                ) : (
                  <span className="text-emerald-700">None — submit will CREATE.</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-2 text-xs underline text-slate-500"
              >
                Sign out
              </button>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">Step 2: profile fields</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  <span className="font-medium">Short ID (e.g. LEON)</span>
                  <input
                    value={shortId}
                    onChange={(e) => setShortId(e.target.value.toUpperCase())}
                    className="border rounded px-2 py-1"
                    placeholder="LEON"
                    maxLength={32}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="font-medium">Email</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border rounded px-2 py-1"
                    type="email"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="font-medium">First name</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="font-medium">Last name</span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                </label>
              </div>

              <fieldset className="border rounded p-3">
                <legend className="text-sm font-medium px-1">Roles</legend>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={roles.includes(r)}
                        onChange={() => toggleRole(r)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Active role</span>
                <select
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value as Role)}
                  className="border rounded px-2 py-1"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h2 className="font-semibold">Step 3: confirm and write</h2>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded p-3 overflow-auto">
{JSON.stringify({
  path: `users/${user.uid}`,
  merge: !!existingDoc,
  data: {
    id: shortId.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    roles,
    activeRole,
    uid: user.uid,
  },
}, null, 2)}
              </pre>

              {phase !== 'DONE' && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!ready || phase === 'WRITING'}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700"
                >
                  {phase === 'WRITING' ? 'Writing…' : existingDoc ? 'Merge into users doc' : 'Create users doc'}
                </button>
              )}

              {phase === 'DONE' && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded p-3 text-sm">
                  Wrote <code>users/{user.uid}</code>. You can now open the main app and log in.
                </div>
              )}

              {phase === 'ERROR' && errorMsg && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded p-3 text-sm">
                  <div className="font-semibold">Error</div>
                  <div className="break-all">{errorMsg}</div>
                  <p className="mt-2">
                    If you see <code>permission-denied</code>: this usually means the user
                    doc already exists with a different schema, or the rules block this
                    field. The merge above only sets fields the rules allow on create.
                    Check <code>firestore.rules</code> and try again.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Bootstrap;
