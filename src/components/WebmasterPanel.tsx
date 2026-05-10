import React, { Suspense, useMemo } from 'react';
import { Teacher } from '../types';
import { motion } from 'motion/react';
import { RoleDistributionPieChart, SeriesWorkloadChart } from './charts';
import { computeWorkload } from '../lib/workload';
import { useSessions } from '../hooks/useSessions';
import { useTimetableEntries } from '../hooks/useTimetableEntries';
import { useDayPeriodConfigs } from '../hooks/useDayPeriodConfigs';
import { 
  Activity, Server, Database, ShieldAlert, 
  Settings, Globe, Cpu, Network, User, Clock, AlertCircle
} from 'lucide-react';
import { PERIODS, WEDNESDAY_PERIODS } from '../constants';
import { parseISO, format } from 'date-fns';

interface Props {
  user: Teacher;
  teachers: Teacher[];
}

export default function WebmasterPanel({ user, teachers }: Props) {
  const { data: sessions } = useSessions();
  const { data: entries } = useTimetableEntries();
  const { data: dayPeriodConfigs } = useDayPeriodConfigs();
  const workloadStats = useMemo(
    () => computeWorkload(entries, teachers, dayPeriodConfigs),
    [entries, teachers, dayPeriodConfigs],
  );
  const roleData = useMemo(() => [
    { name: 'Teachers', value: teachers.length },
    { name: 'Admins', value: teachers.filter(t => t.roles.includes('ADMIN')).length },
    { name: 'Webmasters', value: teachers.filter(t => t.roles.includes('WEBMASTER')).length },
  ], [teachers]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  const stats = [
    { label: 'Server Load', value: '12%', status: 'Demo', icon: Cpu },
    { label: 'API Latency', value: '45ms', status: 'Demo', icon: Network },
    { label: 'DB Connections', value: '14 Active', status: 'Demo', icon: Database },
    { label: 'Error Rate', value: '0.01%', status: 'Demo', icon: ShieldAlert },
  ];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">System Diagnostics</h2>
        <p className="text-slate-500 font-medium text-sm">Core infrastructure monitoring and global cluster health.</p>
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bento-card p-5 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2.5 bg-slate-950 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner border border-slate-800 group-hover:border-indigo-500">
                <stat.icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border transition-colors ${
                stat.status === 'Healthy' || stat.status === 'Optimal' || stat.status === 'Stable' || stat.status === 'Demo'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}>
                {stat.status}
              </span>
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">{stat.label}</p>
            <p className="text-2xl font-black mt-1 tracking-tight text-white relative z-10">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bento-card p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-8 flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-400" />
            Identity Allocation
          </h3>
          <div className="h-[280px] w-full" aria-label="Role distribution chart">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-800 rounded-3xl" />}>
              <RoleDistributionPieChart data={roleData} colors={COLORS} />
            </Suspense>
          </div>
          <div className="grid grid-cols-3 gap-6 mt-8">
            {roleData.map((d, i) => {
              const total = roleData.reduce((s, r) => s + r.value, 0);
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <div key={d.name} className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mb-2 shadow-lg" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-[10px] font-black uppercase text-slate-400">{d.name}</span>
                  <span className="text-lg font-black text-white">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bento-card p-8 flex flex-col gap-8">
          <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3">
            <Settings className="w-5 h-5 text-indigo-400" />
            Global Parameters
          </h3>
          
          <div className="space-y-4">
            {[
              { label: 'Public Web UI', desc: 'Global domain propagation', active: true, color: 'bg-indigo-600' },
              { id: 'backups', label: 'Cluster Backups', desc: 'Secure snapshot @ 02:00', active: true, color: 'bg-emerald-600' },
              { id: 'sync', label: 'Delta Synchronization', desc: 'Real-time state consistency', active: true, color: 'bg-indigo-600' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">{s.label}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{s.desc}</span>
                </div>
                <div className={`w-10 h-5 ${s.color} rounded-full flex items-center px-1 shadow-inner`}>
                  <div className="w-3.5 h-3.5 bg-white rounded-full ml-auto shadow-sm" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
             <div className="flex items-center gap-4 relative z-10">
               <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800">
                <Globe className="w-6 h-6 text-indigo-400" />
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-0.5">Regional Grid</p>
                 <p className="text-xs font-medium text-slate-400">Node: compute-edge (eu-west-1)</p>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Global Stats Table & Chart */}
      <div className="bento-card p-0 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/10">
          <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3">
            <User className="w-5 h-5 text-indigo-400" />
            Infrastructure Workload Analysis
          </h3>
        </div>
        
        <div className="p-8">
          <div className="h-[400px] w-full mb-12" aria-label="Faculty workload chart">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-800 rounded-3xl" />}>
              <SeriesWorkloadChart data={workloadStats} />
            </Suspense>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Asset Identity</th>
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2e] text-center">Morning</th>
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2e] text-center">Afternoon</th>
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2e] text-center">Tech</th>
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2e] text-center">Standby</th>
                  <th className="pb-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2e] text-right text-indigo-400">Net Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {workloadStats.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-2 text-xs font-bold text-slate-300 group-hover:text-white">{row.name}</td>
                    <td className="py-4 px-2 text-xs text-center font-mono text-slate-500">{row.morning}</td>
                    <td className="py-4 px-2 text-xs text-center font-mono text-slate-500">{row.afternoon}</td>
                    <td className="py-4 px-2 text-xs text-center font-mono text-indigo-500 font-bold">{row.tech}</td>
                    <td className="py-4 px-2 text-xs text-center font-mono text-slate-500">{row.standby}</td>
                    <td className="py-4 px-2 text-sm text-right font-black text-indigo-400">{row.total} <span className="text-[10px] opacity-40">m</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
