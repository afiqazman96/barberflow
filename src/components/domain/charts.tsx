"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const tooltipStyle = {
  background: "#1a1814",
  border: "1px solid #2e2a24",
  borderRadius: 12,
  fontSize: 12,
};

export function SalesChart({
  data,
  title = "Sales Trend",
}: {
  data: { day: string; sales: number }[];
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a227" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c9a227" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2e2a24" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#6b6358" fontSize={12} />
            <YAxis stroke="#6b6358" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#c9a227"
              fill="url(#goldFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function PeakHoursChart({
  data,
}: {
  data: { hour: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hours</CardTitle>
      </CardHeader>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#2e2a24" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#6b6358" fontSize={12} />
            <YAxis stroke="#6b6358" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#c9a227" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
