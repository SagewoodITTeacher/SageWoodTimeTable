import React from 'react';
import { LayoutDashboard, LogIn, AlertCircle, Mail, CheckCircle2, KeyRound, UserPlus } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

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
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#09090b] to-[#09090b]">
      <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 flex flex-col items-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20 -rotate-3 border border-indigo-400/20">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight italic uppercase">Curro Hub</h1>
          <p className="text-slate-400 font-medium leading-relaxed">
            Invigilation Management System <br/>
            <span className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-black">Staff Authentication</span>
          </p>
        </div>

        {error && (
          <div role="alert" className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {authUser && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="/bootstrap.html"
                    className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Setup Profile
                  </a>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-block px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {emailLinkPending && (
          <div className="w-full mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3 text-sm">
            <div className="font-bold text-indigo-300 uppercase tracking-widest text-[10px]">Verifying Link</div>
            <p className="text-slate-300 text-xs">
              Confirm your email address to complete the secure sign-in process:
            </p>
            <form onSubmit={handleConfirmEmailLink} className="space-y-3">
              <input
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="teacher@curro.co.za"
                disabled={confirmBusy}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium disabled:opacity-60 transition-all"
              />
              <button
                type="submit"
                disabled={confirmBusy || !confirmEmail.trim()}
                className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-bold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait transition-all shadow-lg shadow-indigo-500/20"
              >
                {confirmBusy ? 'Authenticating...' : 'Confirm Identity'}
              </button>
            </form>
            {emailLinkError && (
              <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-bold break-all uppercase tracking-tighter">
                {emailLinkError}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 rounded-2xl py-4 font-bold hover:bg-slate-100 transition-all active:scale-[0.98] shadow-2xl disabled:opacity-60 disabled:cursor-wait"
        >
          <LogIn className="w-5 h-5" />
          {busy ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <div className="w-full flex items-center gap-4 my-8">
          <span className="flex-1 h-px bg-slate-800" />
          <span className="text-[10px] uppercase tracking-[0.4em] text-slate-600 font-black">Secure</span>
          <span className="flex-1 h-px bg-slate-800" />
        </div>

        {emailSentTo ? (
          <div className="w-full p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-widest text-xs">Dispatch Sent</p>
              <p className="mt-1 text-slate-400 text-xs leading-relaxed">
                A verification link has been dispatched to <span className="text-white font-bold">{emailSentTo}</span>.
                Access the link on this device.
              </p>
              <button
                type="button"
                onClick={() => setEmailSentTo(null)}
                className="mt-3 text-[10px] uppercase tracking-widest font-bold text-indigo-400 hover:text-indigo-300"
              >
                Change Email Address
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-950 p-1.5 text-[10px] uppercase tracking-[0.2em] font-black border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`py-2.5 rounded-xl transition-all ${mode === 'link' ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`py-2.5 rounded-xl transition-all ${mode === 'password' ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Pass
              </button>
            </div>

            <input
              type="email"
              id="login-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Staff Email"
              autoComplete="email"
              disabled={emailBusy || passwordBusy}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium disabled:opacity-60 transition-all"
            />

            {mode === 'link' ? (
              <form onSubmit={handleSendEmailLink}>
                <button
                  type="submit"
                  disabled={emailBusy || !email.trim()}
                  className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white rounded-2xl py-4 font-bold hover:bg-slate-700 transition-all active:scale-[0.98] border border-slate-700 disabled:opacity-60 disabled:cursor-wait"
                >
                  <Mail className="w-5 h-5" />
                  {emailBusy ? 'Dispatching...' : 'Email Sign-in Link'}
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
                  placeholder="Master Password"
                  autoComplete="current-password"
                  disabled={passwordBusy}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium disabled:opacity-60 transition-all"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePasswordAction('signIn')}
                    disabled={passwordBusy || !email.trim() || !password}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-3.5 font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <KeyRound className="w-4 h-4" />
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePasswordAction('create')}
                    disabled={passwordBusy || !email.trim() || password.length < 6}
                    className="flex items-center justify-center gap-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-2xl py-3.5 font-bold hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-10 text-[10px] text-slate-600 font-bold uppercase tracking-[0.5em]">
          Curro OPS • Authorized
        </p>
      </div>
    </div>
  );
}
