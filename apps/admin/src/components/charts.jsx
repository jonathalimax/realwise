import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayLabel } from '../lib/format';

export const CHART_COLORS = {
  emerald: '#10b981',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  red: '#f87171',
};

const axisProps = {
  stroke: '#4b5563',
  tick: { fill: '#9ca3af', fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

function TooltipBox({ active, payload, label, valueFormatter, name }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-0.5">{dayLabel(label)}</p>
      <p className="text-white font-semibold">{valueFormatter(payload[0].value)} <span className="text-gray-500 font-normal">{name}</span></p>
    </div>
  );
}

/**
 * Daily area chart. `data` = [{ date, <valueKey> }]
 */
export function TrendChart({ data, valueKey, color = CHART_COLORS.emerald, valueFormatter = (v) => v, name = '', height = 200 }) {
  const gradientId = `g-${valueKey}-${color.replace('#', '')}`;
  const rows = Array.isArray(data) ? data : [];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" vertical={false} />
          <XAxis dataKey="date" tickFormatter={dayLabel} minTickGap={24} {...axisProps} />
          <YAxis width={56} tickFormatter={valueFormatter} allowDecimals {...axisProps} />
          <Tooltip content={<TooltipBox valueFormatter={valueFormatter} name={name} />} cursor={{ stroke: '#374151' }} />
          <Area type="monotone" dataKey={valueKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarTooltip({ active, payload, valueFormatter }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-0.5 max-w-[220px] truncate">{row.label}</p>
      <p className="text-white font-semibold">{valueFormatter(payload[0].value)}</p>
    </div>
  );
}

/** Horizontal bars. `data` = [{ label, value }] */
export function HBarChart({ data, color = CHART_COLORS.emerald, valueFormatter = (v) => v, height }) {
  const rows = Array.isArray(data) ? data : [];
  const h = height ?? Math.max(120, rows.length * 34 + 16);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" horizontal={false} />
          <XAxis type="number" tickFormatter={valueFormatter} {...axisProps} />
          <YAxis type="category" dataKey="label" width={110} {...axisProps} tickFormatter={(v) => (String(v).length > 16 ? `${String(v).slice(0, 15)}…` : v)} />
          <Tooltip content={<BarTooltip valueFormatter={valueFormatter} />} cursor={{ fill: '#1f2937' }} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
