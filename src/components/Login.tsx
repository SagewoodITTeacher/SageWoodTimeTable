import React from 'react';
import { LayoutDashboard, LogIn, AlertCircle, Mail, CheckCircle2, KeyRound, UserPlus } from 'lucide-react';
import { useFirebase } from '../hooks/useFirebase';

interface LoginProps {
  error?: string | null;
  onError?: (msg: string) => void;
}

export default function Login({ error, onError }: LoginProps) {
  const {
    user: authUser,
    login,
    sendEmailLink,
    emailLinkPending,
    emailLinkError,
    confirmEmailLink,
    signInWithPassword,
    createAccount,
    logout,
  } = useFirebase();
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [emailBusy, setEmailBusy] = React.useState(false);
  const [emailSentTo, setEmailSentTo] = React.useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = React.useState('');
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [mode, setMode] = React.useState<'link' | 'password'>('link');
  const [password, setPassword] = React.useState('');
  const [passwordBusy, setPasswordBusy] = React.useState(false);

  const handleConfirmEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmBusy(true);
    try {
      await confirmEmailLink(confirmEmail);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handlePasswordAction = async (action: 'signIn' | 'create') => {
    setPasswordBusy(true);
    try {
      if (action === 'signIn') {
        await signInWithPassword(email, password);
      } else {
        await createAccount(email, password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      onError?.(code ? `${code}: ${msg}` : msg);
    } finally {
      setPasswordBusy(false);
    }
  };

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

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailSentTo(null);
    try {
      await sendEmailLink(email);
      setEmailSentTo(email.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send sign-in email.';
      onError?.(msg);
    } finally {
      setEmailBusy(false);
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
          <div role="alert" className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {authUser && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="/bootstrap.html"
                    className="inline-block px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                  >
                    Set up your profile &rarr;
                  </a>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-block px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {emailLinkPending && (
          <div className="w-full mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 text-sm">
            <div className="font-bold text-blue-900">Completing email sign-in</div>
            <p className="text-blue-800">
              Confirm the email address you used to request the sign-in link:
            </p>
            <form onSubmit={handleConfirmEmailLink} className="space-y-2">
              <input
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={confirmBusy}
                autoFocus
                className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={confirmBusy || !confirmEmail.trim()}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait"
              >
                {confirmBusy ? 'Signing in…' : 'Confirm and sign in'}
              </button>
            </form>
            {emailLinkError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold break-all">
                {emailLinkError}
              </div>
            )}
            <p className="text-xs text-blue-700">
              Tip: this must match the email exactly (case-sensitive in some setups).
              If the link was already used or expired, request a new one below.
            </p>
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

        <div className="w-full flex items-center gap-3 my-6">
          <span className="flex-1 h-px bg-gray-200" />
          <span className="text-xs uppercase tracking-widest text-gray-400 font-bold">or</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        {emailSentTo ? (
          <div className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Check your inbox</p>
              <p className="mt-1">
                A sign-in link was sent to <span className="font-semibold">{emailSentTo}</span>.
                Click it from this device to complete sign-in.
              </p>
              <button
                type="button"
                onClick={() => setEmailSentTo(null)}
                className="mt-2 text-xs underline font-semibold"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1 text-xs uppercase tracking-widest font-bold">
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`py-2 rounded-xl transition-all ${mode === 'link' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                Email link
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`py-2 rounded-xl transition-all ${mode === 'password' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                Password
              </button>
            </div>

            <input
              type="email"
              id="login-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              disabled={emailBusy || passwordBusy}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium disabled:opacity-60"
            />

            {mode === 'link' ? (
              <form onSubmit={handleSendEmailLink}>
                <button
                  type="submit"
                  disabled={emailBusy || !email.trim()}
                  className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white rounded-2xl py-4 font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-900/10 disabled:opacity-60 disabled:cursor-wait"
                >
                  <Mail className="w-5 h-5" />
                  {emailBusy ? 'Sending link…' : 'Email me a sign-in link'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <input
                  type="password"
                  id="login-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 characters)"
                  autoComplete="current-password"
                  disabled={passwordBusy}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium disabled:opacity-60"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePasswordAction('signIn')}
                    disabled={passwordBusy || !email.trim() || !password}
                    className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-2xl py-3 font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-900/10 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <KeyRound className="w-4 h-4" />
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePasswordAction('create')}
                    disabled={passwordBusy || !email.trim() || password.length < 6}
                    className="flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-900 rounded-2xl py-3 font-bold hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  New here? Click <span className="font-semibold">Create</span> to make an account, then visit <code>/bootstrap.html</code> to set up your roles.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          Curro South Africa • Authorized Staff Only
        </p>
      </div>
    </div>
  );
}
