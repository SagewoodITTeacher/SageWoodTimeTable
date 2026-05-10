import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Teacher, Role } from './types';
import { INITIAL_TEACHERS } from './data';
import Login from './components/Login';
import PanelLoadingSpinner from './components/PanelLoadingSpinner';
import { User as UserIcon, Shield, Briefcase, LayoutDashboard, LogOut, BarChart2, Sun, Moon } from 'lucide-react';
import { useFirebase } from './context/FirebaseContext';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ToastProvider } from './components/ui';

const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'));
const AdminPanel = lazy(() => import('./components/admin'));
const WebmasterPanel = lazy(() => import('./components/WebmasterPanel'));
const OperationalManager = lazy(() => import('./components/OperationalManager'));

export default function App() {
  const { user: authUser, loading: authLoading, logout: googleLogout } = useFirebase();
  const [activeUser, setActiveUser] = useState<Teacher | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [lockedDates] = useState<string[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (window.localStorage.getItem('curro-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('curro-theme', theme);
  }, [theme]);

  const [wideLayout, setWideLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') {return false;}
    return window.localStorage.getItem('curro-wide-layout') === 'true';
  });
  const toggleWideLayout = React.useCallback(() => {
    setWideLayout((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('curro-wide-layout', String(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  // Load the user's Firestore profile when authentication completes.
  useEffect(() => {
    if (authLoading) {return;}
    if (!authUser) {
      setActiveUser(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', authUser.uid));
        if (cancelled) {return;}
        if (!snap.exists()) {
          setLoginError(
            'Your account is not provisioned. Visit /bootstrap.html to set up your profile, or contact a Curro administrator.'
          );
          if (cancelled) {return;}
          setActiveUser(null);
          return;
        }
        const data = snap.data() as Teacher;
        if (!Array.isArray(data.roles) || data.roles.length === 0) {
          setLoginError(
            'Your account has no roles assigned. Visit /bootstrap.html to add roles, or contact a Curro administrator.'
          );
          if (cancelled) {return;}
          setActiveUser(null);
          return;
        }
        const teacher: Teacher = {
          ...data,
          id: data.id ?? authUser.uid,
          email: data.email ?? authUser.email ?? '',
          roles: data.roles,
          activeRole: data.activeRole && data.roles.includes(data.activeRole)
            ? data.activeRole
            : data.roles[0],
        };
        if (cancelled) {return;}
        setActiveUser(teacher);
        setLoginError(null);
      } catch (err) {
        if (cancelled) {return;}
        handleFirestoreError(err, OperationType.GET, `users/${authUser.uid}`);
      } finally {
        if (!cancelled) {setProfileLoading(false);}
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, authLoading, googleLogout]);

  const handleLogout = async () => {
    setActiveUser(null);
    setLoginError(null);
    await googleLogout();
  };

  const switchRole = (role: Role) => {
    if (activeUser?.roles.includes(role)) {
      setActiveUser({ ...activeUser, activeRole: role });
    }
  };

  // The users/teachers listener is the only global listener — everything else
  // is scoped to the panel that consumes it (see src/hooks/use*.ts).
  useEffect(() => {
    if (authLoading || !authUser) {
      if (!authLoading) {
        setIsDataReady(true);
      }
      return;
    }

    const teachersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const teacherMap = new Map<string, Teacher>();
      INITIAL_TEACHERS.forEach(t => teacherMap.set(t.id, t));

      snapshot.docs.forEach(doc => {
        const data = doc.data() as Teacher;
        const staffId = data.id || doc.id;
        teacherMap.set(staffId, { ...data, id: staffId });
      });

      setTeachers(Array.from(teacherMap.values()));
      setIsDataReady(true);
    }, (error) => {
      // Allow the app to load with initial teachers if the listener fails.
      setIsDataReady(true);
      console.error('Failed to list users:', error);
    });

    return () => {
      teachersUnsubscribe();
    };
  }, [authLoading]);

  if (!isDataReady || authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Loading Curro Hub...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !activeUser) {
    return <Login error={loginError} onError={setLoginError} />;
  }

  return (
    <ToastProvider>
    <div className={`min-h-screen transition-colors duration-500 bg-[var(--color-bg-gray)] text-[var(--color-text-dark)]`}>
      {/* Top Bar / Role Switcher */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-7xl flex items-center justify-between px-6 py-3 bg-[var(--color-bento-card)] backdrop-blur-lg border border-[var(--color-bento-border)] rounded-2xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className={`font-bold tracking-tight text-lg leading-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Curro Hub</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-400">Invigilation Ops</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-xl hover:bg-indigo-500/10"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <div role="tablist" aria-label="Role switcher" className={`flex bg-black/40 border border-slate-800 rounded-xl p-1 ${theme === 'light' ? 'bg-slate-100 border-slate-200' : ''}`}>
            {(['WEBMASTER', 'OPERATIONAL_MANAGER', 'ADMIN', 'TEACHER'] as Role[])
              .filter(role => activeUser.roles.includes(role))
              .map((role) => (
                <button
                  key={role}
                  role="tab"
                  aria-selected={activeUser.activeRole === role}
                  onClick={() => switchRole(role)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                    activeUser.activeRole === role
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {role === 'WEBMASTER' && <Shield className="w-3 h-3" />}
                  {role === 'OPERATIONAL_MANAGER' && <BarChart2 className="w-3 h-3" />}
                  {role === 'ADMIN' && <Briefcase className="w-3 h-3" />}
                  {role === 'TEACHER' && <UserIcon className="w-3 h-3" />}
                  <span className="hidden lg:inline">
                    {role === 'OPERATIONAL_MANAGER' ? 'OPS' : (role === 'TEACHER' ? 'Invigilator' : role)}
                  </span>
                </button>
              ))}
          </div>
          
          <div className="flex items-center gap-4 pl-6 border-l border-slate-800">
            <div className="hidden sm:flex flex-col items-end">
              <span className={`text-sm font-bold tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{activeUser.firstName} {activeUser.lastName}</span>
              <button 
                onClick={handleLogout}
                className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'light' ? 'text-slate-500 hover:text-red-500' : 'text-slate-500 hover:text-red-400'} transition-colors flex items-center gap-1.5 mt-0.5`}
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg ${theme === 'light' ? 'shadow-indigo-500/20' : ''}`}>
              {activeUser.firstName[0]}{activeUser.lastName[0]}
            </div>
          </div>
        </div>
      </nav>

      <main className={`pt-32 pb-12 px-6 lg:px-8 mx-auto min-h-screen ${wideLayout ? 'max-w-none' : 'max-w-7xl'}`}>
        <Suspense fallback={<PanelLoadingSpinner />}>
          {activeUser.activeRole === 'TEACHER' && (
            <TeacherDashboard user={activeUser} teachers={teachers} />
          )}
          {activeUser.activeRole === 'ADMIN' && (
            <AdminPanel
              user={activeUser}
              teachers={teachers}
              lockedDates={lockedDates}
              wideLayout={wideLayout}
              onToggleWideLayout={toggleWideLayout}
            />
          )}
          {activeUser.activeRole === 'OPERATIONAL_MANAGER' && (
            <OperationalManager user={activeUser} teachers={teachers} />
          )}
          {activeUser.activeRole === 'WEBMASTER' && (
            <WebmasterPanel user={activeUser} teachers={teachers} />
          )}
        </Suspense>
      </main>

    </div>
    </ToastProvider>
  );
}


