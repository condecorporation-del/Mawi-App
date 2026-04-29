"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyFinancialPoint } from "@/features/dashboard/kpi.schema";
import { formatCurrencyCents } from "@/features/dashboard/format";

type FinancialChartProps = {
  data: MonthlyFinancialPoint[];
};

const MONTH_ABBR: Record<string, string> = {
  "01": "ENE", "02": "FEB", "03": "MAR", "04": "ABR",
  "05": "MAY", "06": "JUN", "07": "JUL", "08": "AGO",
  "09": "SEP", "10": "OCT", "11": "NOV", "12": "DIC",
};

export function FinancialChart({ data }: FinancialChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded border border-dashed border-white/10 text-sm text-on-surface-variant">
        Sin datos mensuales. Registra facturas y gastos para activar esta vista.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    month: MONTH_ABBR[p.month.slice(5, 7)] ?? p.month,
    ingresos:  p.incomeCents,
    gastos:    p.expenseCents,
    utilidad:  p.profitCents,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#00f5ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb4ab" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#ffb4ab" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#849495", fontSize: 10, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#849495", fontSize: 10 }}
            tickFormatter={(v: number) => {
              const m = v / 100_000_000;
              if (Math.abs(m) >= 1) return `$${m.toFixed(1)}M`;
              return `$${(v / 100_000).toFixed(0)}k`;
            }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(8,14,26,0.95)",
              border: "1px solid rgba(0,245,255,0.2)",
              borderRadius: "4px",
              color: "#dde2f3",
              fontSize: 12,
            }}
            formatter={(v) => (typeof v === "number" ? formatCurrencyCents(v) : v)}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke="#00f5ff"
            strokeWidth={2}
            fill="url(#gradIngresos)"
            dot={false}
            activeDot={{ r: 4, fill: "#00f5ff", stroke: "rgba(0,245,255,0.4)", strokeWidth: 6 }}
          />
          <Area
            type="monotone"
            dataKey="gastos"
            stroke="#ffb4ab"
            strokeWidth={2}
            fill="url(#gradGastos)"
            dot={false}
            activeDot={{ r: 4, fill: "#ffb4ab", stroke: "rgba(255,180,171,0.4)", strokeWidth: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
