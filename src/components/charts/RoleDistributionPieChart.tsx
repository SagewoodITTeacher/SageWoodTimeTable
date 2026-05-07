import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface RoleDatum {
  name: string;
  value: number;
}

interface Props {
  data: RoleDatum[];
  colors: string[];
}

export default function RoleDistributionPieChart({ data, colors }: Props) {
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12 h-full" role="status">
        No role data available.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart aria-label="Role distribution">
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#fff', fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
