import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface MeterData {
  meterName: string;
  gapCount: number;
  maxGapMs: number;
}

interface GapsChartProps {
  data: MeterData[];
}

export const GapsChart = ({ data }: GapsChartProps) => {
  const chartData = data.map(meter => ({
    name: meter.meterName,
    gaps: meter.gapCount,
    maxGap: (meter.maxGapMs / 1000).toFixed(1),
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Gaps per Meter</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="name" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))" }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))" }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
          <Bar dataKey="gaps" fill="hsl(var(--warning))" name="Gap Count" radius={[4, 4, 0, 0]} />
          <Bar dataKey="maxGap" fill="hsl(var(--destructive))" name="Max Gap (s)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
