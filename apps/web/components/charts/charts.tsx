"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 16px rgba(0,0,0,.12)",
};

export function AreaTrend({
  data, xKey, yKey, color = "var(--chart-1)", height = 240, prefix = "",
}: {
  data: Record<string, unknown>[]; xKey: string; yKey: string; color?: string; height?: number; prefix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `${prefix}${v >= 1000 ? `${v / 1000}k` : v}`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${prefix}${Number(v).toLocaleString()}`, ""]} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} fill={`url(#g-${yKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({
  data, xKey, yKey, color = "var(--chart-1)", height = 240, prefix = "", horizontal = false,
}: {
  data: Record<string, unknown>[]; xKey: string; yKey: string; color?: string; height?: number; prefix?: string; horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 8 : -16, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `${prefix}${v >= 1000 ? `${v / 1000}k` : v}`} />
            <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} fontSize={12} width={110} stroke="var(--muted-foreground)" />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `${prefix}${v >= 1000 ? `${v / 1000}k` : v}`} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v) => [`${prefix}${Number(v).toLocaleString()}`, ""]} />
        <Bar dataKey={yKey} fill={color} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} barSize={horizontal ? 16 : 36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const donutColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function Donut({
  data, nameKey, valueKey, height = 240, prefix = "",
}: {
  data: Record<string, unknown>[]; nameKey: string; valueKey: string; height?: number; prefix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${prefix}${Number(v).toLocaleString()}`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
