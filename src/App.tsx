import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Teacher, Role } from './types';
import { INITIAL_TEACHERS } from './data';
import Login from './components/Login';
import PanelLoadingSpinner from './components/PanelLoadingSpinner';
import { User as UserIcon, Shield, Briefcase, LayoutDashboard, LogOut, BarChart2 } from 'lucide-react';
import { useFirebase } from './hooks/useFirebase';
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
    if (authLoading) {return;}

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
      handleFirestoreError(error, OperationType.LIST, 'users');
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
    <div className={`min-h-screen transition-colors duration-500 bg-bg-gray`}>
      {/* Top Bar / Role Switcher */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4 border-b-4 transition-all ${
        activeUser.activeRole === 'WEBMASTER' 
          ? 'bg-black border-orange-600 text-white shadow-2xl' 
          : 'bg-curro-blue border-curro-red text-white shadow-md'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg flex items-center justify-center ${
            activeUser.activeRole === 'WEBMASTER' ? 'bg-orange-500 text-white' : 'bg-white text-curro-blue shadow-lg'
          }`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg leading-tight">Curro</span>
            <span className={`text-[10px] uppercase tracking-widest font-black ${activeUser.activeRole === 'WEBMASTER' ? 'text-orange-500' : 'text-white opacity-90'}`}>Invigilation</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div role="tablist" aria-label="Role switcher" className={`flex rounded-lg p-1 border transition-colors ${
            activeUser.activeRole === 'WEBMASTER'
              ? 'bg-white/10 border-white/20'
              : 'bg-white/10 border-white/20'
          }`}>
            {(['WEBMASTER', 'OPERATIONAL_MANAGER', 'ADMIN', 'TEACHER'] as Role[])
              .filter(role => activeUser.roles.includes(role))
              .map((role) => (
                <button
                  key={role}
                  role="tab"
                  aria-selected={activeUser.activeRole === role}
                  onClick={() => switchRole(role)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black tracking-wider uppercase transition-all ${
                    activeUser.activeRole === role
                      ? (role === 'WEBMASTER' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-curro-blue shadow-sm')
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {role === 'WEBMASTER' && <Shield className="w-3 h-3" />}
                  {role === 'OPERATIONAL_MANAGER' && <BarChart2 className="w-3 h-3" />}
                  {role === 'ADMIN' && <Briefcase className="w-3 h-3" />}
                  {role === 'TEACHER' && <UserIcon className="w-3 h-3" />}
                  <span className="hidden xs:inline">
                    {role === 'OPERATIONAL_MANAGER' ? 'OPS' : (role === 'TEACHER' ? 'Invigilator' : role)}
                  </span>
                </button>
              ))}
          </div>
          
          <div className="flex items-center gap-3 pl-4 border-l border-white/20">
            {activeUser.activeRole !== 'OPERATIONAL_MANAGER' && activeUser.roles.includes('OPERATIONAL_MANAGER') && (
              <div
                onClick={() => switchRole('OPERATIONAL_MANAGER')}
                className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30 transition-all shadow-lg group mr-1"
                title="Switch to OPS Panel"
                role="button"
                aria-label="Switch to OPS Panel"
              >
                <BarChart2 className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            )}
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-black leading-tight tracking-tight drop-shadow-sm">{activeUser.firstName} {activeUser.lastName}</span>
              <button 
                onClick={handleLogout}
                className={`text-[10px] uppercase tracking-tighter font-black flex items-center gap-1 mt-0.5 ${
                  activeUser.activeRole === 'WEBMASTER' ? 'text-red-400 hover:text-red-300' : 'text-white/60 hover:text-white'
                }`}
              >
                <LogOut className="w-2.5 h-2.5" />
                Logout
              </button>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ring-2 ring-offset-2 transition-all ${
              activeUser.activeRole === 'WEBMASTER' 
                ? 'ring-orange-500 bg-gray-900 text-orange-500 ring-offset-black' 
                : 'ring-white bg-white/20 text-white ring-offset-curro-blue'
            }`}>
              {activeUser.id.slice(0, 2)}
            </div>
          </div>
        </div>
      </nav>

      <main className={`pt-28 px-4 md:px-8 mx-auto min-h-screen ${wideLayout ? 'max-w-none' : 'max-w-7xl'}`}>
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


