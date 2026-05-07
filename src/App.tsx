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

const SUPER_ADMINS = [
  'MERV', // Merike van Dyk
  'PLAL', // Placid Letswalo  
  'EZRN', // Ezra Nyathi
  'FRAN'  // Franz Nortje
];

export default function App() {
  const { user: authUser, loading: authLoading, login: googleLogin, logout: googleLogout } = useFirebase();
  const [localUser, setLocalUser] = useState<Teacher | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
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

  // Restore local session
  useEffect(() => {
    const saved = localStorage.getItem('curro_loggedInStaffId');
    if (saved) {
      const teacher = teachers.find(t => t.id === saved);
      if (teacher) {
        setLocalUser(teacher);
      }
    }
  }, [teachers]);

  const handleLocalLogin = (email: string, password: string) => {
    if (password !== 'CURRO') {
      setLoginError('Incorrect password. Access denied.');
      return;
    }

    const teacher = teachers.find(t => 
      t.email?.toLowerCase() === email || 
      `${t.firstName.toLowerCase()}.${t.lastName.toLowerCase()}@curro.co.za` === email ||
      `${t.firstName.toLowerCase()}.${t.lastName.toLowerCase()}@curro.com` === email ||
      (t.id.toLowerCase() + '@curro.co.za') === email
    );

    if (!teacher) {
      setLoginError('Email not recognized. Please use your official staff email.');
      return;
    }

    setLoginError(null);
    setLocalUser(teacher);
    localStorage.setItem('curro_loggedInStaffId', teacher.id);
  };

  const handleLogout = () => {
    setLocalUser(null);
    localStorage.removeItem('curro_loggedInStaffId');
  };

  const activeUser = useMemo(() => {
    if (!localUser) return null;
    
    // Update roles based on super admin or admin status
    const updatedUser = { ...localUser };
    
    if (SUPER_ADMINS.includes(localUser.id)) {
      updatedUser.roles = ['WEBMASTER', 'ADMIN', 'OPERATIONAL_MANAGER', 'TEACHER'];
    } else if (localUser.roles.includes('ADMIN')) {
      updatedUser.roles = ['ADMIN', 'TEACHER'];
    } else {
      updatedUser.roles = ['TEACHER'];
    }

    if (!updatedUser.activeRole || !updatedUser.roles.includes(updatedUser.activeRole)) {
      updatedUser.activeRole = updatedUser.roles[0];
    }
    
    return updatedUser;
  }, [localUser]);

  const switchRole = (role: Role) => {
    if (localUser && activeUser?.roles.includes(role)) {
      setLocalUser({ ...localUser, activeRole: role });
    }
  };

  // Keep Firebase sync for data even if using custom login
  useEffect(() => {
    // Safety timeout: if data isn't ready in 8 seconds, force it
    // This prevents being stuck on the loading screen if something fails silently
    const fallbackTimer = setTimeout(() => {
      if (!isDataReady) {
        console.warn("Safety timeout hit: forcing isDataReady to true");
        setIsDataReady(true);
      }
    }, 8000);

    if (authLoading) {
      return () => clearTimeout(fallbackTimer);
    }

    // Note: We ignore authUser for identity, but we might still need it for Firestore permissions
    // or just assume we are using Firestore directly.
    const sessionsUnsubscribe = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamSession));
      if (docs.length > 0) setSessions(docs);
    }, (error) => {
      console.error("Sessions listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    const assignmentsUnsubscribe = onSnapshot(collection(db, 'assignments'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
      setAssignments(docs);
    }, (error) => {
      console.error("Assignments listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'assignments');
    });

    const leaveUnsubscribe = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setLeaveRequests(docs);
    }, (error) => {
      console.error("Leave requests listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
    });

    const timetableUnsubscribe = onSnapshot(collection(db, 'timetableEntries'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
      setTimetableEntries(docs);
    }, (error) => {
      console.error("Timetable entries listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'timetableEntries');
    });

    const venuesUnsubscribe = onSnapshot(collection(db, 'venues'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venue));
      setVenues(docs);
    }, (error) => {
      console.error("Venues listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'venues');
    });

    const extensionsUnsubscribe = onSnapshot(collection(db, 'markingExtensions'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarkingExtension));
      setMarkingExtensions(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'markingExtensions');
    });

    const subjectsUnsubscribe = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(docs);
    }, (error) => {
      console.error("Subjects listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    });
    
    const dayPeriodConfigsUnsubscribe = onSnapshot(collection(db, 'dayPeriodConfigs'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DayPeriodConfig));
      setDayPeriodConfigs(docs);
    }, (error) => {
      console.error("Day period configs listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'dayPeriodConfigs');
    });

    const teachersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const teacherMap = new Map<string, Teacher>();
      
      // Start with initial teachers
      INITIAL_TEACHERS.forEach(t => teacherMap.set(t.id, t));

      snapshot.docs.forEach(doc => {
        const data = doc.data() as Teacher;
        const staffId = data.id || doc.id;
        teacherMap.set(staffId, { ...data, id: staffId });
      });

      const dedupedTeachers = Array.from(teacherMap.values());
      setTeachers(dedupedTeachers);
      setIsDataReady(true);
    }, (error) => {
      console.error("Firestore users listener error:", error);
      // Even if it fails (e.g. permissions), we should allow the app to load 
      // with initial teachers data so the user isn't stuck on a loading screen
      setIsDataReady(true);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      clearTimeout(fallbackTimer);
      sessionsUnsubscribe();
      assignmentsUnsubscribe();
      leaveUnsubscribe();
      timetableUnsubscribe();
      venuesUnsubscribe();
      extensionsUnsubscribe();
      subjectsUnsubscribe();
      dayPeriodConfigsUnsubscribe();
      teachersUnsubscribe();
    };
  }, [authLoading]);

  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Loading Curro Hub...</p>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    return <Login onLogin={handleLocalLogin} error={loginError} />;
  }

  return (
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
          <div className={`flex rounded-lg p-1 border transition-colors ${
            activeUser.activeRole === 'WEBMASTER' 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/10 border-white/20'
          }`}>
            {(['WEBMASTER', 'OPERATIONAL_MANAGER', 'ADMIN', 'TEACHER'] as Role[])
              .filter(role => activeUser.roles.includes(role))
              .map((role) => (
                <button
                  key={role}
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

      <main className="pt-28 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
        {activeUser.activeRole === 'TEACHER' && (
          <TeacherDashboard 
            user={activeUser} 
            sessions={sessions} 
            assignments={assignments} 
            entries={timetableEntries}
            venues={venues}
            teachers={teachers}
          />
        )}
        {activeUser.activeRole === 'ADMIN' && (
          <AdminPanel 
            user={activeUser}
            teachers={teachers}
            sessions={sessions}
            assignments={assignments}
            setAssignments={setAssignments}
            leaveRequests={leaveRequests}
            entries={timetableEntries}
            venues={venues}
            subjects={subjects}
            lockedDates={lockedDates}
            dayPeriodConfigs={dayPeriodConfigs}
          />
        )}
        {activeUser.activeRole === 'OPERATIONAL_MANAGER' && (
          <OperationalManager 
            user={activeUser} 
            entries={timetableEntries}
            extensions={markingExtensions}
            teachers={teachers}
            leaveRequests={leaveRequests}
          />
        )}
        {activeUser.activeRole === 'WEBMASTER' && (
          <WebmasterPanel 
            user={activeUser} 
            teachers={teachers} 
            sessions={sessions}
            entries={timetableEntries}
            dayPeriodConfigs={dayPeriodConfigs}
          />
        )}
      </main>

      {/* Floating Refresh (Simulate real-time update) */}
      <button 
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-[22px] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group ${
          activeUser.activeRole === 'WEBMASTER' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
        }`}
        title="Refresh Data"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
      </button>
    </div>
  );
}


