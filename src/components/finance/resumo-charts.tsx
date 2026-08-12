"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { formatBRL } from "@/lib/money";
import type { FinanceChannel, FinanceDayRow } from "@/lib/finance/summary";

function formatPct(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function ResumoChannelChart({ channels }: { channels: FinanceChannel[] }) {
  if (channels.length === 0) {
    return <p className="rf-chart-empty">Sem dados de canal no período.</p>;
  }

  const data = channels.map((c) => ({
    name: c.label,
    value: c.bruto,
    percent: c.percent,
    color: c.color,
  }));

  return (
    <div className="rf-donut">
      <div className="rf-donut__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatBRL(Number(value ?? 0))}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="rf-donut__legend">
        {channels.map((c) => (
          <li key={c.key} className="rf-donut__item">
            <span
              className="rf-donut__dot"
              style={{ background: c.color }}
              aria-hidden
            />
            <div className="rf-donut__meta">
              <span className="rf-donut__name">{c.label}</span>
              <span className="rf-donut__values">
                {formatBRL(c.bruto)} · {formatPct(c.percent)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumoDailyChart({ daily }: { daily: FinanceDayRow[] }) {
  if (daily.length === 0) {
    return <p className="rf-chart-empty">Sem movimento diário no período.</p>;
  }

  return (
    <div className="rf-combo">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#94A3B8"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            yAxisId="money"
            stroke="#94A3B8"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={52}
            tickFormatter={(v) =>
              Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
            }
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            stroke="#94A3B8"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={36}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === "Cashback %") return formatPct(n);
              return formatBRL(n);
            }}
            labelFormatter={(label) => `Dia ${label}`}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="money"
            dataKey="bruto"
            name="Valor bruto (R$)"
            fill="#1E3A5F"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            yAxisId="money"
            dataKey="liquido"
            name="Valor líquido (R$)"
            fill="#22C55E"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="cashbackPct"
            name="Cashback %"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 3, fill: "#F59E0B" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
