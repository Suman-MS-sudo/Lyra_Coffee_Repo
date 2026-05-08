'use client';

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// ── Shared theme ──────────────────────────────────────────────────
const AMBER   = '#D4A24A';
const AMBER2  = '#e8c47a';
const BLUE    = '#60a5fa';
const GREEN   = '#4ade80';
const PINK    = '#f472b6';
const PURPLE  = '#a78bfa';
const TOOLTIP_STYLE = {
  contentStyle: { background: '#1a1410', border: '1px solid rgba(212,162,74,0.2)', borderRadius: 12, fontSize: 12, color: '#fff' },
  itemStyle: { color: '#fff' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

// ── Revenue + Orders 7-day area chart ────────────────────────────
export interface RevenueDay {
  date:    string;
  revenue: number;   // rupees
  orders:  number;
}

export function RevenueAreaChart({ data }: { data: RevenueDay[] }) {
  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  const maxOrd = Math.max(...data.map(d => d.orders), 1);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={AMBER}  stopOpacity={0.25} />
            <stop offset="95%" stopColor={AMBER}  stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BLUE}   stopOpacity={0.22} />
            <stop offset="95%" stopColor={BLUE}   stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="rev" domain={[0, maxRev * 1.2]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
        <YAxis yAxisId="ord" orientation="right" domain={[0, maxOrd * 1.2]}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(val, name) =>
          name === 'Revenue' ? [`₹${Number(val).toFixed(2)}`, 'Revenue'] : [val, 'Orders']
        } />
        <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue"
          stroke={AMBER} strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: AMBER }} />
        <Area yAxisId="ord" type="monotone" dataKey="orders"  name="Orders"
          stroke={BLUE}  strokeWidth={2} fill="url(#ordGrad)" dot={false} activeDot={{ r: 4, fill: BLUE }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Drink type bar chart ──────────────────────────────────────────
export interface DrinkCount {
  drink: string;
  count: number;
}

const DRINK_COLOR: Record<string, string> = { coffee: AMBER, tea: GREEN, milk: BLUE };
const DRINK_LABEL: Record<string, string> = { coffee: '☕ Coffee', tea: '🍵 Tea', milk: '🥛 Milk' };

export function DrinkBarChart({ data }: { data: DrinkCount[] }) {
  const display = data.map(d => ({ ...d, label: DRINK_LABEL[d.drink] ?? d.drink }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={display} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={val => [val, 'Orders']} />
        <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]}>
          {display.map((d, i) => (
            <Cell key={i} fill={DRINK_COLOR[d.drink] ?? AMBER2} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Payment method pie / donut chart ─────────────────────────────
export interface MethodCount {
  method: string;
  count:  number;
}

const METHOD_COLORS = [AMBER, BLUE, GREEN, PINK, PURPLE];
const METHOD_LABEL: Record<string, string> = {
  upi:        'UPI',
  card:       'Card',
  netbanking: 'Net Banking',
  wallet:     'Wallet',
};

function CustomPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx?: number; cy?: number; midAngle?: number;
  innerRadius?: number; outerRadius?: number; percent?: number;
}) {
  if (cx == null || cy == null || midAngle == null || innerRadius == null || outerRadius == null || percent == null) return null;
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PaymentPieChart({ data }: { data: MethodCount[] }) {
  const display = data.map(d => ({ ...d, label: METHOD_LABEL[d.method] ?? d.method }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={display} dataKey="count" nameKey="label" cx="50%" cy="50%"
          innerRadius={48} outerRadius={72} paddingAngle={3}
          labelLine={false} label={CustomPieLabel}>
          {display.map((_, i) => (
            <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} fillOpacity={0.88} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} formatter={val => [val, 'Payments']} />
        <Legend iconType="circle" iconSize={8}
          formatter={v => <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
