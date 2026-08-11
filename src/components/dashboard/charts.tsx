"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export function DashboardCharts({
  kind,
  data,
}: {
  kind: "cashback" | "categories";
  data: Array<Record<string, string | number>>;
}) {
  if (kind === "cashback") {
    return (
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="dashBlueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dashGoldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C2A46B" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C2A46B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={48}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                boxShadow: "0 8px 24px rgba(37,99,235,0.08)",
              }}
            />
            <Area
              type="monotone"
              dataKey="gerado"
              stroke="#2563EB"
              strokeWidth={2}
              fill="url(#dashBlueFill)"
            />
            <Area
              type="monotone"
              dataKey="utilizado"
              stroke="#C2A46B"
              strokeWidth={2}
              fill="url(#dashGoldFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="mt-2 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            stroke="#94A3B8"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(37,99,235,0.08)",
            }}
          />
          <Bar dataKey="value" fill="#60A5FA" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
