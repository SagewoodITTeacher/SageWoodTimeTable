import React, { Suspense, useState, useEffect } from 'react';
import { Teacher, TimetableEntry, MarkingExtension, HelpRequest } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format, addDays, parseISO, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import { normalizeSubjectName } from '../constants';
import { WorkloadChart } from './charts';
import { useTimetableEntries } from '../hooks/useTimetableEntries';
import { useMarkingExtensions } from '../hooks/useMarkingExtensions';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { 
  BarChart2, Calendar, Plus, Clock, CheckCircle2, XCircle, 
  AlertCircle, ChevronRight, Send, MessageSquare, UserCheck, Timer,
  Shield, ShieldAlert, ShieldCheck, Search, Users, UserPlus, Trash2, PlusCircle,
  Download, CalendarOff, User, Activity, Settings, Cpu, Network, Database
} from 'lucide-react';
import { PERIODS, WEDNESDAY_PERIODS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { SectionCard, Modal } from './ui';

interface Props {
  user: Teacher;
  teachers: Teacher[];
}

const LANGUAGES = ['English', 'Afrikaans', 'Xhosa', 'Sepedi', 'Zulu', 'Sesotho'];
const APPROVERS = ['MERV', 'PLAL', 'EZRN'];
const PUBLIC_HOLIDAYS = ['2026-05-01', '2026-06-16'];

export default function OperationalManager({ user, teachers }: Props) {
  const { data: entries } = useTimetableEntries();
  const { data: extensions } = useMarkingExtensions();
  const { data: leaveRequests } = useLeaveRequests();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [additionalDays, setAdditionalDays] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);

  const workloadData = React.useMemo(() => {
    const morning = Object.fromEntries(teachers.map(t => [t.id, 0]));
    const afternoon = Object.fromEntries(teachers.map(t => [t.id, 0]));
    const tech = Object.fromEntries(teachers.map(t => [t.id, 0]));
    const standbyMinutes = Object.fromEntries(teachers.map(t => [t.id, 0]));
    const total = Object.fromEntries(teachers.map(t => [t.id, 0]));

    entries.forEach(entry => {
      if (!entry.invigilatorAssignments) {return;}
      Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
        if (!total.hasOwnProperty(tid)) {return;}
        const parts = key.split("_");
        const pIdx = parseInt(parts[0]);
        const vId = parts[1];
        const role = parts[2];
        if (vId !== "GRADE" && !entry.venueIds?.includes(vId)) {return;}
        const periods = format(parseISO(entry.date), "EEEE") === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS;
        const p = periods[pIdx];
        if (p) {
          const [h1, m1] = p.start.split(":").map(Number);
          const [h2, m2] = p.end.split(":").map(Number);
          const dur = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (role === "STANDBY") {standbyMinutes[tid] += dur;}
          else if (role === "TECH") {tech[tid] += dur;}
          else if (entry.session === 'MORNING') {morning[tid] += dur;}
          else {afternoon[tid] += dur;}
          total[tid] += dur;
        }
      });
    });

    return teachers.filter(t => {
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      const isMerike = name.includes("merike") && name.includes("van dyk");
      const isFranz = t.id === "NORT" || t.id === "FRAN" || name.includes("franz") || name.includes("nortje");
      const isSpec = t.id === "JACB" || t.id === "SHHU" || t.id === "CPMO" || t.id === "ENYA" || t.id === "ORMA";
      return (t.activeRole !== "WEBMASTER" || isFranz || isSpec) && (t.canInvigilate !== false || isFranz || isSpec) && !isMerike;
    }).map(t => {
      const isSpec = t.id === "JACB" || t.id === "SHHU" || t.id === "CPMO" || t.id === "ENYA" || t.id === "ORMA" || t.id === "FRAN" || t.id === "NORT";
      const loadWeight = isSpec ? 0.7 : 1.0;
      return {
        name: `${t.lastName}, ${t.firstName}`,
        morning: morning[t.id],
        afternoon: afternoon[t.id],
        tech: tech[t.id],
        standby: standbyMinutes[t.id],
        total: total[t.id],
        id: t.id,
        loadWeight,
        adjTotal: Math.round(total[t.id] / loadWeight)
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, teachers]);

  // Real-time help requests listener
  useEffect(() => {
    const q = query(collection(db, 'helpRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      setHelpRequests(requests);
    }, (error) => {
      console.error("Help requests listener error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Gantt Chart logic
  const daysToShow = 21; // Show exactly 3 weeks
  const chartDates = eachDayOfInterval({
    start: viewDate,
    end: addDays(viewDate, daysToShow - 1)
  });

  const getEntryExtension = (entryId: string) => {
    return extensions.find(ext => ext.entryId === entryId && ext.status === 'APPROVED');
  };

  const getEntryPendingExtension = (entryId: string) => {
    return extensions.find(ext => ext.entryId === entryId && ext.status === 'PENDING');
  };

  const isWorkingDay = (date: Date) => {
    const day = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    return day !== 0 && !PUBLIC_HOLIDAYS.includes(dateStr); // Skip Sundays (0) and specific holidays
  };

  const addWorkingDays = (startDate: Date, days: number) => {
    let date = new Date(startDate);
    if (days === 0) {return date;}
    
    let added = 0;
    while (added < days) {
      date = addDays(date, 1);
      if (isWorkingDay(date)) {
        added++;
      }
    }
    return date;
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) {return;}

    setIsSubmitting(true);
    try {
      const newRequest: Omit<MarkingExtension, 'id'> = {
        entryId: selectedEntry.id,
        subject: selectedEntry.subject,
        grade: selectedEntry.grade,
        requestDate: new Date().toISOString(),
        reason: requestReason,
        status: 'PENDING',
        additionalGreenDays: additionalDays,
        requestedBy: user.id
      };

      await addDoc(collection(db, 'markingExtensions'), {
        ...newRequest,
        createdAt: serverTimestamp()
      });

      setIsRequestModalOpen(false);
      setSelectedEntry(null);
      setRequestReason('');
      setAdditionalDays(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markingExtensions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAdminRole = async (targetTeacher: Teacher) => {
    const isAdmin = targetTeacher.roles.includes('ADMIN');
    let newRoles = [...targetTeacher.roles];
    
    if (isAdmin) {
      newRoles = newRoles.filter(r => r !== 'ADMIN');
    } else {
      newRoles.push('ADMIN');
    }

    try {
      const targetId = targetTeacher.uid || targetTeacher.id;
      const userRef = doc(db, 'users', targetId);
      await updateDoc(userRef, { roles: newRoles });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetTeacher.id}`);
    }
  };

  const downloadSeriesWorkloadCSV = () => {
    // 1. Group entries by date and grade to flatten
    const groupedData: { [key: string]: { morning: TimetableEntry[], afternoon: TimetableEntry[] } } = {};

    entries.forEach(entry => {
      const dateStr = entry.date || '';
      const gradeStr = String(entry.grade || '');
      const key = `${dateStr}_${gradeStr}`;
      
      if (!groupedData[key]) {
        groupedData[key] = { morning: [], afternoon: [] };
      }
      
      const session = String(entry.session || '').toUpperCase().trim();
      if (session === 'MORNING') {
        groupedData[key].morning.push(entry);
      } else if (session === 'AFTERNOON') {
        groupedData[key].afternoon.push(entry);
      }
    });

    // 2. Build rows
    const headers = [
      'Date', 
      'Grade', 
      'Morning Subjects', 
      'Morning Total Time (min)', 
      'Morning Total Learners',
      'Afternoon Subjects', 
      'Afternoon Total Time (min)', 
      'Afternoon Total Learners'
    ];

    const rows = Object.entries(groupedData)
      .filter(([key]) => {
        const [date] = key.split('_');
        return date && date.length > 0;
      })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [date, grade] = key.split('_');
        
        const mSubjects = data.morning.map(e => normalizeSubjectName(e.subject)).filter(Boolean).sort().join('; ');
        const mTime = data.morning.reduce((acc, e) => acc + (Number(e.durationMinutes) || 0), 0);
        const mLearners = data.morning.reduce((acc, e) => {
          const totalField = Number(e.totalStudents);
          if (!isNaN(totalField) && totalField > 0) {return acc + totalField;}
          const boys = Number(e.totalBoys) || 0;
          const girls = Number(e.totalGirls) || 0;
          return acc + boys + girls;
        }, 0);

        const aSubjects = data.afternoon.map(e => normalizeSubjectName(e.subject)).filter(Boolean).sort().join('; ');
        const aTime = data.afternoon.reduce((acc, e) => acc + (Number(e.durationMinutes) || 0), 0);
        const aLearners = data.afternoon.reduce((acc, e) => {
          const totalField = Number(e.totalStudents);
          if (!isNaN(totalField) && totalField > 0) {return acc + totalField;}
          const boys = Number(e.totalBoys) || 0;
          const girls = Number(e.totalGirls) || 0;
          return acc + boys + girls;
        }, 0);

        return [
          date,
          grade,
          `"${mSubjects}"`,
          mTime,
          mLearners,
          `"${aSubjects}"`,
          aTime,
          aLearners
        ].join(',');
      });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Exam_Series_Workload_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResolveExtension = async (extId: string, status: 'APPROVED' | 'DENIED', comments: string) => {
    try {
      const extRef = doc(db, 'markingExtensions', extId);
      await updateDoc(extRef, {
        status,
        mitigationComments: comments,
        resolvedBy: user.id,
        resolvedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `markingExtensions/${extId}`);
    }
  };

  const isLanguage = (subject: string) => {
    return LANGUAGES.some(lang => subject.toLowerCase().includes(lang.toLowerCase()));
  };

  const getMarkingPeriod = (entry: TimetableEntry) => {
    const examDate = parseISO(entry.date);
    const approvedExt = getEntryExtension(entry.id);
    const greenDocDays = isLanguage(entry.subject) ? 6 : 5;
    const totalGreenDays = greenDocDays + (approvedExt?.additionalGreenDays || 0);
    
    // Marking starts 1 working day after exam
    const markingStart = addWorkingDays(examDate, 1);
    const markingEnd = addWorkingDays(markingStart, totalGreenDays - 1);
    
    // Moderation (Yellow Days) - usually 2 working days
    const moderationStart = addWorkingDays(markingEnd, 1);
    const moderationEnd = addWorkingDays(moderationStart, 1);

    return {
      markingRange: { start: markingStart, end: markingEnd },
      moderationRange: { start: moderationStart, end: moderationEnd },
      greenDays: totalGreenDays
    };
  };

  // Only show entries that have marking periods intersecting with our chart view
  const relevantEntries = entries.filter(entry => {
    const { markingRange, moderationRange } = getMarkingPeriod(entry);
    return chartDates.some(d => 
      (d >= startOfDay(markingRange.start) && d <= startOfDay(moderationRange.end))
    );
  }).sort((a, b) => a.date.localeCompare(b.date));

  const canApprove = APPROVERS.includes(user.id);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Incident Rapports Section */}
      <SectionCard
        variant="red"
        title="Incident Rapports"
        subtitle="Real-time Invigilation Assistance Log"
        icon={<ShieldAlert className="w-6 h-6" />}
        headerActions={
          <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">
            {helpRequests.filter(r => r.status === 'PENDING').length} PENDING
          </span>
        }
      >
        <div className="overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-gray-200">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Venue</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Invigilator</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stand-By Teacher</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Request</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Confirmation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {helpRequests.map((req) => {
                const createdAt = req.createdAt?.toDate ? req.createdAt.toDate() : (req.createdAt ? new Date(req.createdAt) : new Date());
                const standby = teachers.find(t => t.id === req.standbyId);
                const standbyName = standby ? `${standby.firstName} ${standby.lastName}` : (req.standbyId || 'Unassigned');

                return (
                  <tr key={req.id} className={`hover:bg-gray-50/50 transition-colors ${req.status === 'PENDING' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-4">
                      <span className="text-xs font-black text-gray-900">{format(createdAt, 'dd MMM yyyy')}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-black text-gray-400 font-mono">{format(createdAt, 'HH:mm')}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900">{req.subject}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grade {req.grade}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-black text-text-dark uppercase">{req.venueName}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-black text-gray-400 uppercase">
                          {req.invigilatorName[0]}
                        </div>
                        <span className="text-xs font-bold text-gray-700">{req.invigilatorName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[9px] font-black text-curro-blue uppercase">
                          {standbyName[0]}
                        </div>
                        <span className="text-xs font-bold text-gray-700">{standbyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-curro-red uppercase">{req.option}</span>
                        {req.quantity && (
                          <span className="text-[10px] font-black text-text-muted">Qty: {req.quantity}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center">
                        {req.status === 'COMPLETED' ? (
                          <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                             <CheckCircle2 className="w-3 h-3" />
                             <span className="text-[9px] font-black uppercase tracking-tight">Yes</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
                             <Clock className="w-3 h-3" />
                             <span className="text-[9px] font-black uppercase tracking-tight">No</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {helpRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <ShieldCheck className="w-12 h-12 mb-3" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">All Systems Nominal</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Leave Section */}
      <SectionCard
        variant="blue"
        title="Leave"
        subtitle="Faculty Absence & Leave Records"
        icon={<CalendarOff className="w-6 h-6" />}
        headerActions={
          <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">
            {leaveRequests.filter(r => r.status === 'PENDING').length} PENDING
          </span>
        }
      >
        <div className="overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-gray-200">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Day</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Times</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Invigilator</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</th>
                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...leaveRequests]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((req) => {
                  const teacher = teachers.find(t => t.id === req.teacherId);
                  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : (req.teacherId || 'Unknown');
                  const isToday = isSameDay(parseISO(req.date), new Date());

                  return (
                    <tr key={req.id} className={`hover:bg-gray-50/50 transition-colors ${isToday ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200/50' : ''}`}>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-black ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{format(parseISO(req.date), 'dd MMM yyyy')}</span>
                        {isToday && <span className="ml-2 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Today</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${req.isFullDay ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                          {req.isFullDay ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {req.isFullDay ? (
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Whole Day</span>
                        ) : (
                          <span className="text-xs font-black text-gray-700 font-mono italic">{req.startTime} - {req.endTime}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[9px] font-black text-curro-blue uppercase">
                            {teacherName[0]}
                          </div>
                          <span className="text-xs font-bold text-gray-700">{teacherName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-600 italic line-clamp-1 max-w-[200px]" title={req.reason}>
                          {req.reason || 'No reason provided'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          {req.status === 'APPROVED' ? (
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                               <CheckCircle2 className="w-3 h-3" />
                               <span className="text-[9px] font-black uppercase tracking-tight">Approved</span>
                            </div>
                          ) : req.status === 'DENIED' ? (
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                               <XCircle className="w-3 h-3" />
                               <span className="text-[9px] font-black uppercase tracking-tight">Denied</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
                               <Clock className="w-3 h-3" />
                               <span className="text-[9px] font-black uppercase tracking-tight">Pending</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {leaveRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Calendar className="w-12 h-12 mb-3" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">No Leave Records</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Header Section */}
      <SectionCard
        variant="emerald"
        title="Marking Operations"
        subtitle="Operational Progress & Extensions"
        icon={
          <button
            onClick={downloadSeriesWorkloadCSV}
            className="hover:bg-white/30 rounded-2xl flex items-center justify-center transition-all active:scale-95 group w-full h-full"
            title="Download Series Workload CSV"
          >
            <Download className="w-6 h-6 group-hover:animate-bounce" />
          </button>
        }
        headerActions={
          <div className="flex flex-col md:items-end gap-2">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Chart View Start</span>
            <input
              type="date"
              value={format(viewDate, 'yyyy-MM-dd')}
              onChange={(e) => setViewDate(parseISO(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:text-emerald-700 transition-all outline-none"
            />
          </div>
        }
      >
        <div className="p-0 border-b border-gray-50 bg-gray-50/50">
          {/* Legend */}
          <div className="flex items-center gap-6 p-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Marking (Green Days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Moderation (Yellow Days)</span>
            </div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-3 h-3 bg-gray-300 rounded-sm"></div>
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Exam Date</span>
            </div>
          </div>
        </div>

        <div className="p-0 overflow-auto max-h-[600px] relative">
          <div className="min-w-max flex flex-col">
            {/* Gantt Header */}
            <div className="flex border-b border-gray-100 sticky top-0 bg-white z-30 shadow-sm">
              <div className="w-64 p-4 border-r border-gray-100 flex-shrink-0 bg-gray-50 sticky left-0 z-40 border-b border-gray-100">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Subject / Grade</span>
              </div>
              {chartDates.map((date, i) => {
                const isToday = isSameDay(date, new Date());
                const isSun = date.getDay() === 0;
                const isHoliday = PUBLIC_HOLIDAYS.includes(format(date, 'yyyy-MM-dd'));
                
                return (
                  <div key={i} className={`flex-1 min-w-[50px] py-4 text-center border-r border-gray-50 flex flex-col items-center gap-1 
                    ${isToday ? 'bg-blue-50/50' : ''} 
                    ${isSun || isHoliday ? 'bg-gray-100/50' : ''}`}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isSun || isHoliday ? 'text-curro-red/60' : 'text-gray-400'}`}>
                      {format(date, 'EEE')}
                    </span>
                    <span className={`text-[11px] font-black ${isToday ? 'text-blue-600' : (isSun || isHoliday ? 'text-gray-400' : 'text-gray-900')}`}>
                      {format(date, 'd')}
                    </span>
                    {isToday && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></div>}
                  </div>
                );
              })}
            </div>

            {/* Gantt Rows */}
            <div className="divide-y divide-gray-50 bg-white">
              {relevantEntries.map(entry => {
                const { markingRange, moderationRange, greenDays } = getMarkingPeriod(entry);
                const examDateStr = entry.date;
                const pending = getEntryPendingExtension(entry.id);
                const approved = getEntryExtension(entry.id);

                return (
                  <div key={entry.id} className="flex group hover:bg-gray-50/30 transition-colors">
                    <div className="w-64 p-4 border-r border-gray-100 flex-shrink-0 flex items-center justify-between transition-all sticky left-0 bg-white group-hover:bg-gray-50/80 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      <div className="pr-2">
                        <h4 className="text-xs font-black text-gray-900 tracking-tight leading-snug">{normalizeSubjectName(entry.subject)}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Grade {entry.grade}</span>
                          {pending && <span className="flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-pulse"><AlertCircle className="w-2 h-2" /> Pending</span>}
                          {approved && <span className="flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-tighter"><CheckCircle2 className="w-2 h-2" /> Ext. +{approved.additionalGreenDays}d</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedEntry(entry); setIsRequestModalOpen(true); }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex-shrink-0"
                        title="Request Extension"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {chartDates.map((date, i) => {
                      const dayStr = format(date, 'yyyy-MM-dd');
                      const isExamDay = dayStr === examDateStr;
                      const isMarkingMode = date >= startOfDay(markingRange.start) && date <= startOfDay(markingRange.end);
                      const isModerationMode = date >= startOfDay(moderationRange.start) && date <= startOfDay(moderationRange.end);
                      const isWeekendOrHoliday = !isWorkingDay(date);

                      return (
                        <div key={i} className={`flex-1 min-w-[50px] border-r border-gray-50/50 flex items-center justify-center py-2.5 
                          ${isSameDay(date, new Date()) ? 'bg-blue-50/20' : ''} 
                          ${isWeekendOrHoliday ? 'bg-gray-50/30' : ''}`}
                        >
                          {isExamDay && (
                            <div className="w-full mx-1 h-7 bg-gray-200 rounded-md border border-gray-300 flex items-center justify-center shadow-inner" title="Exam Date">
                              <Calendar className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          {isMarkingMode && (
                            <div 
                              className={`w-full mx-0.5 h-7 bg-emerald-500 rounded-sm shadow-sm ring-1 ring-emerald-600/20 flex items-center justify-center ${isWeekendOrHoliday ? 'opacity-40' : ''}`}
                              title={`Marking Phase (Day ${greenDays})`}
                            >
                              {isSameDay(date, markingRange.start) && <div className="w-1 h-3.5 bg-white/30 rounded-full mr-auto ml-1"></div>}
                              {isSameDay(date, markingRange.end) && <div className="w-1 h-3.5 bg-black/10 rounded-full ml-auto mr-1"></div>}
                            </div>
                          )}
                          {isModerationMode && (
                            <div 
                              className={`w-full mx-0.5 h-7 bg-yellow-400 rounded-sm shadow-sm ring-1 ring-yellow-500/20 flex items-center justify-center ${isWeekendOrHoliday ? 'opacity-40' : ''}`}
                              title="Moderation Phase"
                            >
                              {isSameDay(date, moderationRange.start) && <div className="w-1.5 h-1.5 rounded-full bg-yellow-600/30"></div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {relevantEntries.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-gray-300" />
                  </div>
                  <h5 className="font-black text-gray-400 uppercase tracking-widest text-xs">No entries in this view range</h5>
                  <p className="text-gray-400 text-[10px] uppercase mt-2">Adjust the view start date above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Pending Requests Section (For Approvers) */}
      {canApprove && extensions.filter(ex => ex.status === 'PENDING').length > 0 && (
        <SectionCard
          variant="amber"
          title="Awaiting Extension Approvals"
          icon={<AlertCircle className="w-6 h-6" />}
          headerActions={
            <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">{extensions.filter(ex => ex.status === 'PENDING').length} PENDING</span>
          }
        >
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {extensions.filter(ex => ex.status === 'PENDING').map(ext => (
              <RequestCard key={ext.id} ext={ext} onResolve={handleResolveExtension} />
            ))}
          </div>
        </SectionCard>
      )}
      
      {/* Subject Extension Log */}
      <SectionCard
        variant="emerald"
        title="Subject Extension Log"
        subtitle="Historical and Current Extension Submissions"
        icon={<MessageSquare className="w-5 h-5" />}
        headerActions={
          <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">{extensions.length} TOTAL REQUESTS</span>
        }
        className="mb-8"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason for Extension</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Expected Completion</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Additional Days</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Requested Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...extensions]
                .sort((a, b) => b.requestDate.localeCompare(a.requestDate))
                .map((ext) => {
                  const entry = entries.find(e => e.id === ext.entryId);
                  const periods = entry ? getMarkingPeriod(entry) : null;
                  
                  return (
                    <tr key={ext.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900">{normalizeSubjectName(ext.subject)}</span>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grade {ext.grade}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                           <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-xs italic">
                             "{ext.reason}"
                           </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {periods ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-emerald-600 uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {format(periods.markingRange.end, 'dd MMM yyyy')}
                            </span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">End of Marking Phase</span>
                          </div>
                        ) : (
                          <span className="text-xs font-black text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-amber-600 uppercase flex items-center gap-1">
                            <Plus className="w-3 h-3" />
                            {ext.additionalGreenDays} {ext.additionalGreenDays === 1 ? 'Day' : 'Days'}
                          </span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Extension Requested</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-gray-900">{format(parseISO(ext.requestDate), 'dd MMM yyyy')}</span>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(parseISO(ext.requestDate), 'HH:mm')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {ext.status === 'APPROVED' && (
                            <div className="flex flex-col items-center gap-1 text-emerald-600" title="Approved">
                              <ShieldCheck className="w-5 h-5 shadow-sm" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Approved</span>
                            </div>
                          )}
                          {ext.status === 'DENIED' && (
                            <div className="flex flex-col items-center gap-1 text-red-600" title="Denied">
                              <ShieldAlert className="w-5 h-5 shadow-sm" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Denied</span>
                            </div>
                          )}
                          {ext.status === 'PENDING' && (
                            <div className="flex flex-col items-center gap-1 text-amber-500 animate-pulse" title="Pending">
                              <AlertCircle className="w-5 h-5 shadow-sm" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Pending</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {extensions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No extension requests recorded yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Admin Privilege Management (OPS Only) */}
      <SectionCard
        variant="zinc"
        title="Admin Role Management"
        subtitle="Control Access to Scheduler & Timetable Tools"
        icon={<Shield className="w-6 h-6 text-curro-red" />}
        headerActions={
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search faculty..."
              aria-label="Search faculty"
              value={adminSearchTerm}
              onChange={(e) => setAdminSearchTerm(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:bg-white focus:text-gray-900 transition-all outline-none"
            />
          </div>
        }
        className="mb-10"
      >
        <div className="max-h-[500px] overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/30">
          {teachers
            .filter(t => 
              t.firstName.toLowerCase().includes(adminSearchTerm.toLowerCase()) || 
              t.lastName.toLowerCase().includes(adminSearchTerm.toLowerCase()) || 
              t.id.toLowerCase().includes(adminSearchTerm.toLowerCase())
            )
            .sort((a, b) => {
              const aIsAdmin = a.roles.includes('ADMIN');
              const bIsAdmin = b.roles.includes('ADMIN');
              if (aIsAdmin && !bIsAdmin) {return -1;}
              if (!aIsAdmin && bIsAdmin) {return 1;}
              return a.lastName.localeCompare(b.lastName);
            })
            .map(t => (
              <div key={t.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${t.roles.includes('ADMIN') ? 'bg-curro-red/[0.03] border-curro-red/20 ring-1 ring-curro-red/5' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all ${t.roles.includes('ADMIN') ? 'bg-curro-red text-white shadow-lg shadow-curro-red/20' : 'bg-gray-100 text-gray-400'}`}>
                    {t.lastName[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 leading-tight">{t.firstName} {t.lastName}</h4>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{t.id} • {t.roles.includes('WEBMASTER') ? 'WEBMASTER' : t.roles.includes('OPERATIONAL_MANAGER') ? 'OPS' : 'STAFF'}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => toggleAdminRole(t)}
                  hidden={t.id === user.id || t.roles.includes('WEBMASTER')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${t.roles.includes('ADMIN') 
                    ? 'bg-curro-red/10 text-curro-red hover:bg-curro-red hover:text-white' 
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                >
                  {t.roles.includes('ADMIN') ? (
                    <>
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      Grant Admin
                    </>
                  )}
                </button>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Workload Balance Chart (Rule 18) */}
      <SectionCard
        variant="blue"
        title="Workload Balance Chart"
        subtitle="Faculty Invigilation Load Monitoring"
        icon={<BarChart2 className="w-6 h-6" />}
        className="mt-8"
      >
        <div className="p-8">
          <div className="h-[400px] w-full">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-zinc-100 rounded" />}>
              <WorkloadChart data={workloadData} />
            </Suspense>
          </div>
          
          <div className="mt-8 overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="border-b border-gray-100">
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Faculty Name</th>
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Morn</th>
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aft</th>
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tech</th>
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">StdBy</th>
                      <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Min</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {workloadData.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                         <td className="py-3 text-xs font-bold text-gray-900">{row.name}</td>
                         <td className="py-3 text-xs text-center font-mono text-blue-500">{row.morning}</td>
                         <td className="py-3 text-xs text-center font-mono text-purple-500">{row.afternoon}</td>
                         <td className="py-3 text-xs text-center font-mono text-sky-500 font-bold">{row.tech}</td>
                         <td className="py-3 text-xs text-center font-mono text-emerald-500">{row.standby}</td>
                         <td className="py-3 text-xs text-right font-black text-curro-blue">{row.total}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      </SectionCard>

      {/* Request Modal */}
      <Modal
        open={isRequestModalOpen && !!selectedEntry}
        onClose={() => { setIsRequestModalOpen(false); setSelectedEntry(null); }}
        title="Marking Extension"
        size="md"
      >
        <form onSubmit={handleRequestExtension} className="flex flex-col gap-6">
          <p className="text-sm text-text-muted font-bold uppercase tracking-widest">
            {selectedEntry?.subject} — Grade {selectedEntry?.grade}
          </p>
          <div>
            <label htmlFor="ext-days" className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Additional Days (Green)</label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAdditionalDays(n)}
                  className={`py-3 rounded-2xl font-black text-sm transition-all ${additionalDays === n ? 'bg-emerald-600 text-white shadow-lg ring-4 ring-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ext-reason" className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Reason for Request</label>
            <textarea
              id="ext-reason"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              required
              rows={4}
              placeholder="Provide context for the extension requirement..."
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold text-gray-900 focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <button
              type="button"
              onClick={() => { setIsRequestModalOpen(false); setSelectedEntry(null); }}
              className="py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-400 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

interface RequestCardProps {
  ext: MarkingExtension;
  onResolve: (extId: string, status: 'APPROVED' | 'DENIED', comments: string) => Promise<void>;
}

const RequestCard: React.FC<RequestCardProps> = ({ ext, onResolve }) => {
  const [comments, setComments] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-sm font-black text-gray-900 leading-tight">{ext.subject}</h4>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Grade {ext.grade} • Requested by {ext.requestedBy}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[14px] font-black text-amber-600">+{ext.additionalGreenDays}d</span>
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{format(parseISO(ext.requestDate), 'MMM d, HH:mm')}</span>
        </div>
      </div>
      
      <p className="text-xs text-gray-600 italic bg-gray-50 p-3 rounded-xl border-l-4 border-amber-300 mb-6">
        "{ext.reason}"
      </p>

      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          Review Request
        </button>
      ) : (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2">
          <textarea 
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Mitigation Comments (Optional)..."
            className="w-full bg-gray-50 rounded-xl p-3 text-xs font-bold border-2 border-transparent focus:border-amber-500 transition-all outline-none resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button 
              onClick={() => onResolve(ext.id, 'APPROVED', comments)}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
            <button 
              onClick={() => onResolve(ext.id, 'DENIED', comments)}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
              <XCircle className="w-3 h-3" />
              Deny
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
