import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export interface SeriesWorkloadDatum {
  name: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
}

interface Props {
  data: SeriesWorkloadDatum[];
}

export default function SeriesWorkloadChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12 h-full" role="status">
        No workload data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="20%" aria-label="Series workload by teacher">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          fontSize={8}
          angle={-90}
          textAnchor="end"
          interval={0}
          height={100}
        />
        <YAxis stroke="#6b7280" fontSize={10} />
        <Tooltip
          contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#fff', fontSize: '12px' }}
        />
        <Bar dataKey="tech" fill="#0ea5e9" stackId="a" name="Tech" />
        <Bar dataKey="morning" fill="#3b82f6" stackId="a" name="Morning" />
        <Bar dataKey="afternoon" fill="#a855f7" stackId="a" name="Afternoon" />
        <Bar dataKey="standby" fill="#10b981" stackId="a" name="Standby" />
      </BarChart>
    </ResponsiveContainer>
  );
}
