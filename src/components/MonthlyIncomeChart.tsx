"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/*
 * One series (income in BRL), so one hue and no legend; the card title names it.
 * #059669 passes the palette checks on both the light and the dark surface.
 * Text uses ink colors, never the bar color.
 */
const BAR = "#059669";
const THEME = {
  light: { grid: "#e2e8f0", text: "#475569", cursor: "#f1f5f9" },
  dark: { grid: "#334155", text: "#94a3b8", cursor: "#1e293b" },
};

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

export interface MonthPoint {
  month: string; // "2026-11"
  amountBRL: number;
  feesBRL: number;
}

export function MonthlyIncomeChart({ data }: { data: MonthPoint[] }) {
  const theme = THEME[usePrefersDark() ? "dark" : "light"];
  return (
    <div className="h-64 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          barCategoryGap="22%"
          // The table under the chart is the accessible version; keep the SVG out of the tab order.
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonth(m)}
            tick={{ fill: theme.text, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            // Every month on wide screens; Recharts drops some on a phone instead of overlapping.
            interval="preserveStartEnd"
            minTickGap={6}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(v, "BRL", { compact: true })}
            tick={{ fill: theme.text, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ fill: theme.cursor }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as MonthPoint;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <p className="font-medium">{formatMonth(p.month, true)}</p>
                  <p className="tabular">{formatMoney(p.amountBRL, "BRL")} received</p>
                  {p.feesBRL > 0 && (
                    <p className="tabular text-slate-600 dark:text-slate-400">
                      Fees {formatMoney(p.feesBRL, "BRL")}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Bar
            dataKey="amountBRL"
            fill={BAR}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
