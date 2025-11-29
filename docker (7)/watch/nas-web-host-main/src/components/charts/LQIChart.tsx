import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface MeterData {
  meterName: string;
  avgLqi: number;
}

interface LQIChartProps {
  data: MeterData[];
}

export const LQIChart = ({ data }: LQIChartProps) => {
  const chartData = data.map(meter => ({
    name: meter.meterName,
    lqi: Math.round(meter.avgLqi),
  }));

  const getColor = (lqi: number) => {
    if (lqi >= 150) return "hsl(var(--success))";
    if (lqi >= 100) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Average LQI per Meter</h3>
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
          <Bar dataKey="lqi" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.lqi)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
