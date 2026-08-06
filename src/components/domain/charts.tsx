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
  background: "#ffffff",
  border: "1px solid #e8e2d6",
  borderRadius: 12,
  fontSize: 12,
  color: "#1c1917",
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
                <stop offset="0%" stopColor="#c5a059" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c5a059" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e8e2d6" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#a8a29e" fontSize={12} />
            <YAxis stroke="#a8a29e" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#c5a059"
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
            <CartesianGrid stroke="#e8e2d6" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#a8a29e" fontSize={12} />
            <YAxis stroke="#a8a29e" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#c5a059" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
