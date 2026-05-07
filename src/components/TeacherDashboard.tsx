import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Teacher, ExamSession, Assignment, TimetableEntry, Venue, LeaveRequest, HelpOption, HelpRequest } from '../types';
import { format, parseISO, isSameDay, isWednesday, addMinutes } from 'date-fns';
import { normalizeSubjectName, PERIODS, WEDNESDAY_PERIODS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Calendar, Search, AlertCircle, Plus, X, Send, Info, Bell, MessageSquare, PhoneCall, Zap, User } from 'lucide-react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface Props {
  user: Teacher;
  sessions: ExamSession[];
  assignments: Assignment[];
  entries: TimetableEntry[];
  venues: Venue[];
  teachers: Teacher[];
}

export default function TeacherDashboard({ user, sessions, assignments, entries, venues, teachers }: Props) {
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
    if (!user.id) return;

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
        // Play beep sound
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
        }
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
      alert('Leave request submitted successfully!');
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('Failed to submit leave request.');
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
    if (entry.date !== selectedDate) return false;
    if (!entry.invigilatorAssignments) return false;
    return Object.entries(entry.invigilatorAssignments).some(([key, tid]) => {
      if (tid !== user.id) return false;
      const vId = key.split('_')[1];
      const role = key.split('_')[2];
      const isStandby = vId === 'GRADE' || role === 'STANDBY';
      if (!isStandby && entry.venueIds && !entry.venueIds.includes(vId)) return false;
      return true;
    });
  }).flatMap(entry => {
    const myAssignments = Object.entries(entry.invigilatorAssignments || {})
      .filter(([key, tid]) => {
        if (tid !== user.id) return false;
        const vId = key.split('_')[1];
        const role = key.split('_')[2];
        const isStandby = vId === 'GRADE' || role === 'STANDBY';
        if (!isStandby && entry.venueIds && !entry.venueIds.includes(vId)) return false;
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
    if (!currentActivity || currentActivity.type !== 'period') return null;
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
    if (!currentActivity) return 0;
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
    if (!currentActivity || !selectedHelpOption) return;

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
      alert('Failed to send help request.');
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
    <div className="flex flex-col pb-12 overflow-x-hidden">
      {/* Hidden audio for notifications */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      {/* Salutation Header */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-curro-blue text-white px-5 pb-8 pt-4 -mx-4 md:-mx-8 mb-0 flex flex-col items-center text-center shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <Zap className="w-64 h-64 -ml-20 -mt-10 rotate-12" />
        </div>

        <div className="text-xs opacity-80 mb-1 font-black uppercase tracking-[0.2em]">
          {format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')}
        </div>
        <h2 className="text-2xl font-black leading-tight mb-4 relative z-10 transition-all">
          {isSameDay(dateObj, new Date()) ? 'Invigilating Now' : `Hello, ${user.firstName}!`}
        </h2>
        
        {/* Date Picker & Action */}
        <div className="relative z-10 w-full max-w-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
            <Calendar className="w-4 h-4 text-white/60" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-xs font-black uppercase tracking-widest outline-none w-full [color-scheme:dark]"
            />
          </div>
          
          <button 
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white text-curro-blue px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all w-full"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex flex-col -mt-4 relative z-20 px-4">
        
        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-curro-blue" />
              Your Daily View
            </h3>
            <span className="bg-curro-blue/10 text-curro-blue px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter">
              {totalItems} Tasks
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {totalItems === 0 ? (
              <div className="p-10 flex flex-col items-center text-center bg-gray-50/50">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <Calendar className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest leading-relaxed">
                  No invigilation assigned <br/> for this date.
                </p>
              </div>
            ) : (
              <>
                {combinedSchedule.map((item, idx) => {
                  const isCurrent = currentTimeStr >= item.time && currentTimeStr < item.endTime;
                  return (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-5 flex items-center gap-5 transition-all ${isCurrent ? 'bg-blue-50/50 relative' : 'hover:bg-gray-50 opacity-100 grayscale-[0.3]'}`}
                    >
                      {isCurrent && <div className="absolute top-0 left-0 bottom-0 w-1 bg-curro-blue" />}
                      <div className="flex flex-col items-center min-w-[60px]">
                        <span className={`text-sm font-black font-mono ${isCurrent ? 'text-curro-blue' : 'text-text-dark'}`}>
                          {item.time}
                        </span>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">
                          {item.label}
                        </span>
                        <div className="w-10 h-px bg-gray-100 my-1.5" />
                        <span className="text-xs font-black text-text-muted font-mono">
                          {item.endTime}
                        </span>
                      </div>
                      
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-curro-red" />
                          <span className="text-[10px] font-black text-text-dark uppercase tracking-tighter">
                            {item.venueName}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-text-dark leading-tight group-hover:text-curro-blue transition-colors">
                          {item.subject} {item.type === 'period' && item.paperType !== 'Normal' ? `(${item.paperType})` : ''}
                        </h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${isCurrent ? 'bg-curro-blue text-white border-curro-blue' : 'bg-curro-blue/10 text-curro-blue border-curro-blue/10'}`}>
                            Grade {item.grade}
                          </span>
                          {item.type === 'period' ? (
                            <span className="text-[8px] font-black bg-gray-100 text-text-muted px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              {item.session}
                            </span>
                          ) : (
                            <span className="text-[8px] font-black text-white bg-curro-blue px-2 py-0.5 rounded-full uppercase tracking-tighter">
                              {/* @ts-ignore */}
                              {item.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Support Section - Constantly Visible HUD */}
        <div className={`mt-0 mb-6 bg-white rounded-2xl p-5 border shadow-xl transition-all ${currentActivity ? 'border-curro-blue/20' : 'border-gray-100 opacity-80'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 text-white rounded-xl shadow-md rotate-3 transition-colors ${currentActivity ? 'bg-curro-blue' : 'bg-gray-400'}`}>
                <Bell className={`w-4 h-4 ${currentActivity ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <h4 className="text-sm font-black text-text-dark uppercase tracking-tight">Main Hall Team</h4>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                  Rapid Response • Grade {currentActivity?.grade || 'N/A'}
                </p>
              </div>
            </div>
            {nextInvigilatorName && (
              <div className="text-right">
                <span className="text-[8px] font-black text-curro-blue uppercase tracking-widest block">Next Takeover</span>
                <span className="text-[10px] font-black text-text-dark">{nextInvigilatorName}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Session Progress</span>
              <span className={`text-[10px] font-black font-mono ${currentActivity ? 'text-curro-blue' : 'text-gray-400'}`}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
              <motion.div 
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                className={`h-full rounded-full relative transition-colors ${currentActivity ? 'bg-gradient-to-r from-curro-blue to-blue-400' : 'bg-gray-300'}`}
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-white/20 blur-sm" />
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MapPin className={`w-3 h-3 ${currentActivity ? 'text-curro-red' : 'text-gray-400'}`} />
                <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Current Venue</span>
              </div>
              <div className={`text-[11px] font-black truncate ${currentActivity ? 'text-text-dark' : 'text-text-muted italic'}`}>
                {currentActivity?.venueName || 'None Active'}
              </div>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 mb-0.5">
                <User className={`w-3 h-3 ${currentActivity ? 'text-curro-blue' : 'text-gray-400'}`} />
                <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">Standby Support</span>
              </div>
              <div className={`text-[11px] font-black truncate ${currentActivity ? 'text-text-dark' : 'text-text-muted italic'}`}>
                {/* @ts-ignore */}
                {currentActivity?.standbyName || 'N/A'}
              </div>
            </div>
          </div>
          
          <button 
            disabled={!currentActivity}
            onClick={() => setIsHelpModalOpen(true)}
            className={`w-full text-white text-[11px] font-black py-3 rounded-xl uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 ${
              currentActivity ? 'bg-curro-red shadow-red-500/20 active:scale-95' : 'bg-gray-300 shadow-none grayscale cursor-not-allowed'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            {currentActivity ? 'Call HELP' : 'No Active Session'}
          </button>
        </div>

      </div>

      {/* Standby Live Notification Popup */}
      <AnimatePresence>
        {activeNotification && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-text-dark/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-curro-red animate-pulse-slow"
            >
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-curro-red/10 text-curro-red rounded-full flex items-center justify-center mb-6 ring-8 ring-curro-red/5">
                  <AlertCircle className="w-10 h-10" />
                </div>
                
                <h3 className="text-xl font-black text-text-dark uppercase tracking-tight mb-2">HELP REQUESTED!</h3>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full mb-6 text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-text-muted uppercase">Venue</span>
                    <span className="text-[11px] font-black text-text-dark uppercase">{activeNotification.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-text-muted uppercase">Subject</span>
                    <span className="text-[11px] font-black text-text-dark">{activeNotification.subject} (Gr {activeNotification.grade})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-text-muted uppercase">Teacher</span>
                    <span className="text-[11px] font-black text-text-dark">{activeNotification.invigilatorName}</span>
                  </div>
                  <div className="h-px bg-gray-200 my-2" />
                  <div className="flex flex-col items-center pt-2">
                    <span className="text-[9px] font-black text-text-muted uppercase mb-1">Issue Reported:</span>
                    <span className="text-sm font-black text-curro-red uppercase italic">
                      {activeNotification.option}
                      {activeNotification.quantity ? ` (${activeNotification.quantity} required)` : ''}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => handleAcknowledgeNotification(activeNotification)}
                  className="w-full bg-curro-blue text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  STATED: I RECEIVED (OK)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Call Help Modal */}
      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpModalOpen(false)}
              className="absolute inset-0 bg-text-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full max-w-lg bg-white rounded-t-[40px] shadow-2xl overflow-hidden pb-10"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2" />
              
              <div className="px-6 py-6 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-text-dark uppercase tracking-tight">Need Assistance?</h3>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Select an option to alert Standby</p>
                </div>
                <button 
                  onClick={() => setIsHelpModalOpen(false)}
                  className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {(['Question Paper Required', 'Folio required', 'Toiletpaper required', 'Bathroom Break', 'SOS'] as HelpOption[]).map((option) => (
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

                {selectedHelpOption === 'Question Paper Required' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-4 space-y-3"
                  >
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-5 py-10 text-center opacity-40">
        <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.3em]">
          Curro South Africa • Invigilation Systems
        </p>
      </div>

      {/* Leave Request Modal */}
      <AnimatePresence>
        {isLeaveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveModalOpen(false)}
              className="absolute inset-0 bg-text-dark/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-[32px] shadow-2xl overflow-hidden pb-safe"
            >
              <div className="px-6 py-6 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-curro-red/10 text-curro-red rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-dark uppercase tracking-tight">Request Leave</h3>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Submit for approval</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-text-muted hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitLeave} className="p-6 space-y-6">
                <div className="space-y-4">
                  {/* Leave Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Type of Leave
                    </label>
                    <select
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
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Date of Leave
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input 
                        type="date"
                        required
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">
                      Reason / Additional Notes
                    </label>
                    <textarea 
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

