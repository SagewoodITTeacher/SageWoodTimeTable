import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Teacher, LeaveRequest, HelpOption, HelpRequest } from '../types';
import { format, parseISO, isSameDay, isWednesday, addMinutes } from 'date-fns';
import { normalizeSubjectName, PERIODS, WEDNESDAY_PERIODS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Calendar, Search, AlertCircle, Plus, X, Send, Info, Bell, MessageSquare, PhoneCall, Zap, User, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Modal, useToast } from './ui';
import { useSessions } from '../hooks/useSessions';
import { useAssignments } from '../hooks/useAssignments';
import { useTimetableEntries } from '../hooks/useTimetableEntries';
import { useVenues } from '../hooks/useVenues';

interface Props {
  user: Teacher;
  teachers: Teacher[];
}

export default function TeacherDashboard({ user, teachers }: Props) {
  const { data: sessions } = useSessions();
  const { data: assignments } = useAssignments();
  const { data: entries } = useTimetableEntries();
  const { data: venues } = useVenues();
  const toast = useToast();
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [helpFormError, setHelpFormError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  // Help Request State
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [selectedHelpOption, setSelectedHelpOption] = useState<HelpOption | null>(null);
  const [qpQuantity, setQpQuantity] = useState<number>(1);
  const [activeNotification, setActiveNotification] = useState<HelpRequest | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Leave Form State
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [leaveDate, setLeaveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leaveReason, setLeaveReason] = useState('');

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  // Listen for help requests where user is the standby
  useEffect(() => {
    if (!user.id) {return;}

    const q = query(
      collection(db, 'helpRequests'),
      where('standbyId', '==', user.id),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      if (requests.length > 0) {
        // Show the newest pending notification
        setActiveNotification(requests[0]);
        // Play beep sound and surface a visual toast in case audio is blocked/muted
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
        }
        toast.info(`Help requested at ${requests[0].venueName}: ${requests[0].option}`, { duration: 6000 });
      } else {
        setActiveNotification(null);
      }
    });

    return () => unsubscribe();
  }, [user.id]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        teacherId: user.id,
        date: leaveDate,
        dateEnd: leaveDate, // Default to same day for now
        type: leaveType,
        reason: leaveReason,
        status: 'PENDING',
        isFullDay: true,
        createdAt: serverTimestamp(),
      });
      setIsLeaveModalOpen(false);
      setLeaveReason('');
      toast.success("Leave request submitted successfully");
      setLeaveFormError(null);
    } catch (error) {
      console.error('Error submitting leave:', error);
      const message = "Failed to submit leave request. Please try again.";
      setLeaveFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter legacy sessions for selected date
  const filteredSessions = sessions.filter(s => s.date === selectedDate);

  // Filter timetable entries for selected date where user is assigned
  const dateObj = parseISO(selectedDate);
  const isWed = isWednesday(dateObj);
  const periodsToUse = isWed ? WEDNESDAY_PERIODS : PERIODS;

  const getArrivalTime = (session: { startTime: string; grade: number; location: string; paper?: string; subject: string }) => {
    const isMorning = session.startTime === '08:20';
    const isGrade12 = session.grade === 12;
    const isHall = session.location.toLowerCase().includes('hall') || session.location.toLowerCase().includes('assembly');
    const isPrac = session.paper?.toLowerCase().includes('prac') || session.subject?.toLowerCase().includes('prac');

    if (isGrade12 && isHall && !isPrac) {
      return isMorning ? '07:30' : '12:30';
    }
    return isMorning ? '07:50' : '12:50';
  };

  const mySchedule = entries.filter(entry => {
    if (entry.date !== selectedDate) {return false;}
    if (!entry.invigilatorAssignments) {return false;}
    return Object.entries(entry.invigilatorAssignments).some(([key, tid]) => {
      if (tid !== user.id) {return false;}
      const vId = key.split('_')[1];
      const role = key.split('_')[2];
      const isStandby = vId === 'GRADE' || role === 'STANDBY';
      if (!isStandby && entry.venueIds && !entry.venueIds.includes(vId)) {return false;}
      return true;
    });
  }).flatMap(entry => {
    const myAssignments = Object.entries(entry.invigilatorAssignments || {})
      .filter(([key, tid]) => {
        if (tid !== user.id) {return false;}
        const vId = key.split('_')[1];
        const role = key.split('_')[2];
        const isStandby = vId === 'GRADE' || role === 'STANDBY';
        if (!isStandby && entry.venueIds && !entry.venueIds.includes(vId)) {return false;}
        return true;
      })
      .map(([key, _]) => {
        const [pIdx, vId, role, subIdx] = key.split('_');
        return { 
          pIdx: parseInt(pIdx), 
          vId, 
          role, 
          subIdx: parseInt(subIdx || '0'),
          entry 
        };
      });

    return myAssignments.map(assignment => {
      const venue = venues.find(v => v.id === assignment.vId);
      const periodData = periodsToUse[assignment.pIdx];
      
      // Find standby teacher for this grade/period
      const standbyKey = `${assignment.pIdx}_GRADE_STANDBY`;
      const standbyId = entry.invigilatorAssignments?.[standbyKey];
      const standbyTeacher = teachers.find(t => t.id === standbyId);

      return {
        id: `${entry.id}-${assignment.pIdx}-${assignment.vId}`,
        type: 'period' as const,
        time: periodData?.start || '00:00',
        endTime: periodData?.end || '00:00',
        pIdx: assignment.pIdx,
        vId: assignment.vId,
        label: periodData?.label || `P${assignment.pIdx + 1}`,
        venueName: venue?.name || assignment.vId,
        subject: normalizeSubjectName(entry.subject),
        paperType: entry.paperType,
        grade: entry.grade,
        session: entry.session,
        standbyId: standbyId,
        standbyName: standbyTeacher ? `${standbyTeacher.firstName} ${standbyTeacher.lastName}` : (standbyId || 'None assigned')
      };
    });
  });

  const dutySchedule = [];
  
  if (user.breakDutyDates?.includes(selectedDate)) {
    dutySchedule.push({
      id: `duty-break`,
      type: 'period' as const,
      time: isWed ? '10:00' : '10:20',
      endTime: isWed ? '10:50' : '11:10',
      label: 'Break Duty',
      venueName: 'Break Duty',
      subject: 'Break Duty',
      paperType: 'Normal',
      grade: 0,
      session: 'MORNING'
    });
  }

  if (user.afternoonDutyDates?.includes(selectedDate)) {
    dutySchedule.push({
      id: `duty-afternoon`,
      type: 'period' as const,
      time: '14:30',
      endTime: '15:00',
      label: 'Afternoon Duty',
      venueName: 'Afternoon Break Duty',
      subject: 'Duty',
      paperType: 'Normal',
      grade: 0,
      session: 'AFTERNOON'
    });
  }

  const legacySchedule = sessions
    .filter(s => s.date === selectedDate)
    .map(s => {
      // Calculate end time from start time and duration
      const [startH, startM] = s.startTime.split(':').map(Number);
      const totalMinutes = startH * 60 + startM + s.durationMinutes;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

      return {
        id: `legacy-${s.id}`,
        type: 'legacy' as const,
        time: s.startTime,
        endTime: endTime,
        label: 'Session',
        arrivalTime: getArrivalTime({ ...s, paper: s.paper }),
        venueName: s.location,
        subject: normalizeSubjectName(s.subject),
        status: s.status,
        grade: s.grade
      };
    });

  const combinedSchedule = [...mySchedule, ...legacySchedule, ...dutySchedule].sort((a, b) => a.time.localeCompare(b.time));

  // Determine current and next activity
  const currentTimeStr = format(now, 'HH:mm');
  const currentActivity = combinedSchedule.find(item => currentTimeStr >= item.time && currentTimeStr < item.endTime);
  const nextActivityIdx = combinedSchedule.findIndex(item => item.time > currentTimeStr);
  const nextActivity = nextActivityIdx !== -1 ? combinedSchedule[nextActivityIdx] : null;

  // Find who takes over in the current venue next period
  const nextInvigilatorName = useMemo(() => {
    if (!currentActivity || currentActivity.type !== 'period') {return null;}
    const nextPeriodIdx = (currentActivity as any).pIdx + 1;
    const currentVenueId = (currentActivity as any).vId;
    
    // Look in all entries for the same date and next period but same venue
    const takeoverEntry = entries.find(e => e.date === selectedDate && e.invigilatorAssignments && Object.keys(e.invigilatorAssignments).some(k => k.startsWith(`${nextPeriodIdx}_${currentVenueId}_`)));
    if (takeoverEntry) {
      // Find role - usually PRIMARY or SECOND
      const assignmentKey = Object.keys(takeoverEntry.invigilatorAssignments!).find(k => k.startsWith(`${nextPeriodIdx}_${currentVenueId}_`));
      if (assignmentKey) {
        const tId = takeoverEntry.invigilatorAssignments![assignmentKey];
        const teacher = teachers.find(t => t.id === tId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : tId;
      }
    }
    return null;
  }, [currentActivity, entries, teachers, selectedDate]);

  // Progress Bar Calculation
  const progressPercent = useMemo(() => {
    if (!currentActivity) {return 0;}
    const [startH, startM] = currentActivity.time.split(':').map(Number);
    const [endH, endM] = currentActivity.endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const currentTotal = now.getHours() * 60 + now.getMinutes();
    
    const duration = endTotal - startTotal;
    const elapsed = currentTotal - startTotal;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  }, [currentActivity, now]);

  const handleCallHelp = async () => {
    if (!currentActivity || !selectedHelpOption) {return;}

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'helpRequests'), {
        venueId: (currentActivity as any).vId || '',
        venueName: currentActivity.venueName,
        invigilatorId: user.id,
        invigilatorName: `${user.firstName} ${user.lastName}`,
        standbyId: (currentActivity as any).standbyId || '',
        option: selectedHelpOption,
        quantity: selectedHelpOption === 'Question Paper Required' ? qpQuantity : null,
        subject: currentActivity.subject,
        grade: currentActivity.grade,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });
      setIsHelpModalOpen(false);
      setSelectedHelpOption(null);
      setQpQuantity(1);
    } catch (error) {
      console.error('Error calling for help:', error);
      const message = "Failed to send help request. Try the call button again.";
      setHelpFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeNotification = async (notif: HelpRequest) => {
    try {
      await updateDoc(doc(db, 'helpRequests', notif.id), {
        status: 'COMPLETED'
      });
      setActiveNotification(null);
    } catch (error) {
      console.error('Error acknowledging help:', error);
    }
  };

  const totalItems = combinedSchedule.length;

  return (
    <div className="flex flex-col pb-12 overflow-x-hidden space-y-6">
      {/* Hidden audio for notifications */}
      <audio ref={audioRef} src="/sounds/help-alert.mp3" preload="auto" />

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Salutation Header - Bento Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-8 bento-card bg-gradient-to-br from-indigo-600/20 to-violet-700/20 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col gap-2">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-[0.25em]">
              {format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')}
            </div>
            <h2 className="text-4xl font-black text-white leading-tight">
              {isSameDay(dateObj, new Date()) ? "You're on Duty" : `Hi, ${user.firstName}!`}
            </h2>
            <p className="text-slate-400 text-sm max-w-sm mt-1">
              {isSameDay(dateObj, new Date()) 
                ? "Your invigilation schedule is ready. Stay sharp and reach out if you need support."
                : "View your upcoming assignments and manage your leave requests."}
            </p>
          </div>

          <div className="relative z-10 w-full md:w-64 flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none w-full [color-scheme:dark]"
              />
            </div>
            
            <button 
              onClick={() => setIsLeaveModalOpen(true)}
              className="group flex items-center justify-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl shadow-indigo-500/10"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              Request Leave
            </button>
          </div>
        </motion.div>

        {/* Support Section - Bento Style */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`col-span-12 lg:col-span-4 bento-card flex flex-col justify-between h-full min-h-[280px] ${currentActivity ? 'bento-card-active' : ''}`}
        >
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${currentActivity ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                <Bell className={`w-6 h-6 ${currentActivity ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Active Status</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-2 h-2 rounded-full ${currentActivity ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {currentActivity ? 'On Session' : 'No Duty Now'}
                  </span>
                </div>
              </div>
            </div>
            {currentActivity && (
              <div className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-500/20 uppercase tracking-tighter">
                Grade {currentActivity.grade}
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Completion</span>
              <span className={`text-xs font-bold font-mono ${currentActivity ? 'text-indigo-400' : 'text-slate-600'}`}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <motion.div 
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                className={`h-full rounded-full transition-colors ${currentActivity ? 'bg-gradient-to-r from-indigo-500 to-indigo-400' : 'bg-slate-700'}`}
              />
            </div>
          </div>
          
          <button 
            disabled={!currentActivity}
            onClick={() => setIsHelpModalOpen(true)}
            className={`w-full text-[11px] font-bold py-4 rounded-xl uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
              currentActivity 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-700 active:scale-95' 
                : 'bg-slate-800 text-slate-500 shadow-none grayscale cursor-not-allowed'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            {currentActivity ? 'Call Assistance' : 'System Standby'}
          </button>
        </motion.div>

        {/* Daily Schedule Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="col-span-12 bento-card p-0 overflow-hidden"
        >
          <div className="px-8 py-6 border-b border-slate-800/50 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">
                Daily Assignment Flow
              </h3>
            </div>
            <div className="bg-slate-800/80 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-tighter border border-slate-700">
              {totalItems} Scheduled Events
            </div>
          </div>

          <div className="divide-y divide-slate-800/30">
            {totalItems === 0 ? (
              <div className="p-20 flex flex-col items-center text-center bg-slate-900/20">
                <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-slate-700">
                  <Calendar className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Clear Schedule <br/> for this date.
                </p>
              </div>
            ) : (
              combinedSchedule.map((item, idx) => {
                const isCurrent = currentTimeStr >= item.time && currentTimeStr < item.endTime;
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-6 flex items-center gap-8 transition-all ${isCurrent ? 'bg-indigo-500/5 relative' : 'hover:bg-white/[0.02]'}`}
                  >
                    {isCurrent && <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500" />}
                    
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span className={`text-lg font-black font-mono tracking-tighter ${isCurrent ? 'text-indigo-400' : 'text-slate-300'}`}>
                        {item.time}
                      </span>
                      <div className="w-8 h-[2px] bg-slate-800 my-2" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                        {item.label}
                      </span>
                    </div>
                    
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                          {item.venueName}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-200 leading-tight">
                        {item.subject} {item.type === 'period' && item.paperType !== 'Normal' ? <span className="text-slate-500 font-medium text-sm">({item.paperType})</span> : ''}
                      </h4>
                      <div className="mt-3 flex items-center gap-3">
                        <div className={`text-[10px] font-bold px-3 py-1 rounded-lg border uppercase tracking-[0.1em] ${isCurrent ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                          Grade {item.grade}
                        </div>
                        {item.type === 'period' ? (
                          <div className="text-[10px] font-bold bg-slate-800/30 text-slate-500 px-3 py-1 rounded-lg border border-slate-800 uppercase tracking-[0.1em]">
                            {item.session} Session
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-white bg-indigo-500 px-3 py-1 rounded-lg uppercase tracking-[0.1em] shadow-lg shadow-indigo-500/10">
                            {/* @ts-ignore */}
                            {item.status}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:flex flex-col items-end min-w-[120px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ends At</span>
                      <span className="text-sm font-bold text-slate-400 font-mono italic">{item.endTime}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

      </div>

      {/* Standby Live Notification Popup */}
      <Modal
        open={!!activeNotification}
        onClose={() => activeNotification && handleAcknowledgeNotification(activeNotification)}
        title="HELP REQUESTED!"
        size="sm"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-curro-red/10 text-curro-red rounded-full flex items-center justify-center mb-6 ring-8 ring-curro-red/5">
            <AlertCircle className="w-10 h-10" />
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full mb-6 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-text-muted uppercase">Venue</span>
              <span className="text-xs font-black text-text-dark uppercase">{activeNotification?.venueName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-text-muted uppercase">Subject</span>
              <span className="text-xs font-black text-text-dark">{activeNotification?.subject} (Gr {activeNotification?.grade})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-text-muted uppercase">Teacher</span>
              <span className="text-xs font-black text-text-dark">{activeNotification?.invigilatorName}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex flex-col items-center pt-2">
              <span className="text-[10px] font-black text-text-muted uppercase mb-1">Issue Reported:</span>
              <span className="text-sm font-black text-curro-red uppercase italic">
                {activeNotification?.option}
                {activeNotification?.quantity ? ` (${activeNotification.quantity} required)` : ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => activeNotification && handleAcknowledgeNotification(activeNotification)}
            className="w-full bg-curro-blue text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            STATED: I RECEIVED (OK)
          </button>
        </div>
      </Modal>

      {/* Call Help Modal */}
      <Modal open={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Request help" size="md">
              <div className="space-y-3">
                {helpFormError && (
                  <div role="alert" className="mb-1 rounded-xl border border-curro-red/30 bg-curro-red/5 px-3 py-2 text-xs font-bold text-curro-red">
                    {helpFormError}
                  </div>
                )}
                {(['Question Paper Required', 'Folio required', 'Toiletpaper required', 'Bathroom Break'] as HelpOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSelectedHelpOption(option)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                      selectedHelpOption === option
                        ? 'bg-curro-blue border-curro-blue text-white shadow-lg'
                        : 'bg-gray-50 border-gray-100 text-text-dark hover:border-curro-blue/30'
                    }`}
                  >
                    <span className="font-black text-xs uppercase tracking-widest">{option}</span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                      selectedHelpOption === option ? 'border-white text-white' : 'border-gray-200 text-transparent'
                    }`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </button>
                ))}

                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-curro-red/20" />
                  <span className="text-[10px] font-black text-curro-red uppercase tracking-widest">Emergency</span>
                  <div className="flex-1 h-px bg-curro-red/20" />
                </div>

                <button
                  onClick={() => setSelectedHelpOption('SOS')}
                  className={`w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                    selectedHelpOption === 'SOS'
                      ? 'bg-curro-red border-curro-red text-white shadow-lg shadow-red-500/20'
                      : 'bg-curro-red/5 border-curro-red/30 text-curro-red hover:bg-curro-red/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-black text-sm uppercase tracking-widest">SOS</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    selectedHelpOption === 'SOS' ? 'border-white text-white' : 'border-curro-red/30 text-transparent'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </button>

                {selectedHelpOption === 'Question Paper Required' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-4 space-y-3"
                  >
                    <label htmlFor="qp-quantity" className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Number of Papers Required
                    </label>
                    <div className="flex items-center gap-4 bg-blue-50 p-2 rounded-2xl border border-blue-100">
                      <button 
                        onClick={() => setQpQuantity(Math.max(1, qpQuantity - 1))}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-curro-blue font-black"
                      >
                        -
                      </button>
                      <div className="flex-1 text-center font-black text-lg text-curro-blue">{qpQuantity}</div>
                      <button 
                        onClick={() => setQpQuantity(qpQuantity + 1)}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-curro-blue font-black"
                      >
                        +
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="pt-6">
                  <button 
                    disabled={!selectedHelpOption || isSubmitting}
                    onClick={handleCallHelp}
                    className="w-full bg-curro-blue text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                  >
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <>
                      <Send className="w-4 h-4" />
                      Dispatch Assistance
                    </>}
                  </button>
                </div>
              </div>
      </Modal>

      {/* Footer */}
      <div className="px-5 py-10 text-center opacity-40">
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">
          Curro South Africa • Invigilation Systems
        </p>
      </div>

      {/* Leave Request Modal */}
      <Modal open={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title="Request leave" size="md">
              <form onSubmit={handleSubmitLeave} className="space-y-6">
                {leaveFormError && (
                  <div role="alert" className="rounded-2xl border border-curro-red/30 bg-curro-red/5 px-4 py-3 text-sm font-bold text-curro-red">
                    {leaveFormError}
                  </div>
                )}
                <div className="space-y-4">
                  {/* Leave Type */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="leave-type" className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Type of Leave
                    </label>
                    <select
                      id="leave-type"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                    >
                      <option value="Sick Leave">Sick Leave</option>
                      <option value="Arrangement">Arrangement</option>
                      <option value="Special leave">Special Leave</option>
                    </select>
                  </div>

                  {/* Date Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="leave-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Date of Leave
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="date"
                        id="leave-date"
                        required
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="leave-reason" className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Reason / Additional Notes
                    </label>
                    <textarea
                      id="leave-reason"
                      required
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Please provide context for your request..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-curro-blue outline-none transition-all min-h-[120px] resize-none"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    Note: Your request will be sent to the administration team for review. 
                    You will be notified once a decision has been made.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-curro-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </form>
      </Modal>
    </div>
  );
}

