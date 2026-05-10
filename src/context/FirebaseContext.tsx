import React, { useEffect, useState, useCallback, ReactNode, createContext, useContext, useMemo } from 'react';
import { auth, googleProvider } from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
} from 'firebase/auth';

export interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  emailLinkPending: boolean;
  emailLinkError: string | null;
  login: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  confirmEmailLink: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

const EMAIL_FOR_SIGN_IN_KEY = 'curro:emailForSignIn';

const isEmailLink = () =>
  typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailLinkPending, setEmailLinkPending] = useState(() => isEmailLink());
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);

  const completeWithEmail = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailLinkError('Please enter the email you used to request the link.');
      return;
    }
    setEmailLinkError(null);
    try {
      await signInWithEmailLink(auth, trimmed, window.location.href);
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
      window.history.replaceState({}, document.title, window.location.pathname);
      setEmailLinkPending(false);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setEmailLinkError(code ? `${code}: ${msg}` : msg);
      console.error('Email-link sign-in failed', err);
    }
  }, []);

  useEffect(() => {
    if (isEmailLink()) {
      const cached = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (cached) {
        completeWithEmail(cached);
      }
      // else: leave emailLinkPending=true; Login page will render an email field.
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [completeWithEmail]);

  const login = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      if (error instanceof Error && (error as any).code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        throw new Error(
          `Unauthorized Domain: Please add "${domain}" to your Firebase Console -> Authentication -> Settings -> Authorized Domains list.`
        );
      }
      throw error;
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim();
    if (!trimmed) {throw new Error('Please enter an email address.');}
    if (!password) {throw new Error('Please enter a password.');}
    await signInWithEmailAndPassword(auth, trimmed, password);
  }, []);

  const createAccount = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim();
    if (!trimmed) {throw new Error('Please enter an email address.');}
    if (password.length < 6) {throw new Error('Password must be at least 6 characters.');}
    await createUserWithEmailAndPassword(auth, trimmed, password);
  }, []);

  const sendEmailLink = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) {throw new Error('Please enter an email address.');}
    const actionCodeSettings = {
      url: `${window.location.origin}/`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, trimmed, actionCodeSettings);
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, trimmed);
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    emailLinkPending,
    emailLinkError,
    login,
    sendEmailLink,
    confirmEmailLink: completeWithEmail,
    signInWithPassword,
    createAccount,
    logout,
  }), [
    user,
    loading,
    emailLinkPending,
    emailLinkError,
    login,
    sendEmailLink,
    completeWithEmail,
    signInWithPassword,
    createAccount,
    logout
  ]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}
