import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export interface WorkloadDatum {
  name: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
}

interface Props {
  data: WorkloadDatum[];
}

export default function WorkloadChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12 h-full" role="status">
        No assignments yet — generate or add one.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="20%" aria-label="Workload by teacher">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis
          dataKey="name"
          stroke="#9ca3af"
          fontSize={8}
          angle={-90}
          textAnchor="end"
          interval={0}
          height={100}
        />
        <YAxis stroke="#9ca3af" fontSize={10} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
        />
        <Bar dataKey="tech" fill="#0ea5e9" stackId="a" name="Tech" />
        <Bar dataKey="morning" fill="#3b82f6" stackId="a" name="Morning" />
        <Bar dataKey="afternoon" fill="#a855f7" stackId="a" name="Afternoon" />
        <Bar dataKey="standby" fill="#10b981" stackId="a" name="Standby" />
      </BarChart>
    </ResponsiveContainer>
  );
}
