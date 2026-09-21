import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CHART_COLORS } from '../utils/constants.js';

const empty = (data) => data.every((d) => d.value === 0);

function NoData() {
  return <div className="flex h-56 items-center justify-center text-sm text-slate-400">No issues to chart yet</div>;
}

// Data always comes from the API (dashboard stats); nothing here is hardcoded.
export function StatusChart({ data }) {
  if (empty(data)) return <NoData />;
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={`Status distribution: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {visible.map((d) => <Cell key={d.name} fill={CHART_COLORS.status[d.name]} />)}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriorityChart({ data }) {
  if (empty(data)) return <NoData />;
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={`Priority distribution: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name="Issues" radius={[6, 6, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={CHART_COLORS.priority[d.name]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
