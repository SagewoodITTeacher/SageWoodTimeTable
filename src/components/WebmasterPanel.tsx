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
    { label: 'Server Load', value: '12%', status: 'Healthy', icon: Cpu },
    { label: 'API Latency', value: '45ms', status: 'Optimal', icon: Network },
    { label: 'DB Connections', value: '14 Active', status: 'Stable', icon: Database },
    { label: 'Error Rate', value: '0.01%', status: 'Low', icon: ShieldAlert },
  ];

  return (
    <div className="-mx-4 md:-mx-8 -mt-4 px-4 md:px-8 pt-6 pb-20 bg-zinc-950 text-white font-sans rounded-3xl flex flex-col gap-6 min-h-[calc(100vh-6rem)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">System Diagnostics</h2>
        <p className="text-gray-400 font-medium text-sm">Core infrastructure monitoring and global settings.</p>
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-900 border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-colors">
                <stat.icon className="w-4 h-4 text-gray-400 group-hover:text-inherit" />
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                stat.status === 'Healthy' || stat.status === 'Optimal' || stat.status === 'Stable' 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-amber-500/10 text-amber-500'
              }`}>
                {stat.status}
              </span>
            </div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
            <p className="text-xl font-black mt-0.5 tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6">
          <h3 className="text-sm font-black uppercase tracking-tight mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            Role Distribution
          </h3>
          <div className="h-[250px] w-full">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-zinc-800 rounded" />}>
              <RoleDistributionPieChart data={roleData} colors={COLORS} />
            </Suspense>
          </div>
          <div className="flex justify-center flex-wrap gap-4 mt-2">
            {roleData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-[10px] font-black uppercase text-gray-400">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 flex flex-col gap-6">
          <h3 className="text-sm font-black uppercase flex items-center gap-2">
            <Settings className="w-4 h-4 text-orange-500" />
            Global Controls
          </h3>
          
          <div className="space-y-3">
            {[
              { label: 'Public Web App', desc: 'Domain restriction bypass', active: true, color: 'bg-orange-600' },
              { label: 'Automatic Backups', desc: 'Nightly snapshots at 02:00', active: true, color: 'bg-emerald-600' },
              { label: 'Real-time Sync', desc: 'Instant push updates', active: true, color: 'bg-orange-600' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className="text-[10px] text-gray-500">{s.desc}</span>
                </div>
                <div className={`w-9 h-4.5 ${s.color} rounded-full flex items-center px-0.5`}>
                  <div className="w-3.5 h-3.5 bg-white rounded-full ml-auto shadow-sm" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
             <div className="flex items-center gap-3">
               <Globe className="w-8 h-8 text-orange-500" />
               <div>
                 <p className="text-xs font-black uppercase text-orange-500">Regional Deployment</p>
                 <p className="text-[10px] text-orange-400 opacity-60">System running on compute-edge (eu-west-1)</p>
               </div>
             </div>
          </div>
        </div>
      </div>
      {/* Global Stats Table & Chart */}
      <div className="flex flex-col gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 overflow-hidden">
          <h3 className="text-sm font-black uppercase tracking-tight mb-6 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-500" />
            Faculty Assignment Statistics
          </h3>
          
          <div className="h-[400px] w-full mb-8">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-zinc-800 rounded" />}>
              <SeriesWorkloadChart data={workloadStats} />
            </Suspense>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Faculty Member Name</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Morning (Excl. Tech)</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Afternoon (Excl. Tech)</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Tech Specialist</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Stand-By</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Total (min)</th>
                  <th className="pb-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Adj. Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {workloadStats.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-xs font-bold text-gray-300">{row.name}</td>
                    <td className="py-3 text-xs text-center font-mono text-blue-400">{row.morning}</td>
                    <td className="py-3 text-xs text-center font-mono text-purple-400">{row.afternoon}</td>
                    <td className="py-3 text-xs text-center font-mono text-sky-400 font-bold">{row.tech}</td>
                    <td className="py-3 text-xs text-center font-mono text-emerald-400">{row.standby}</td>
                    <td className="py-3 text-xs text-right font-black text-orange-500">{row.total}</td>
                    <td className="py-3 text-xs text-right font-black text-white">{Math.round(row.total / row.loadWeight)}</td>
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
