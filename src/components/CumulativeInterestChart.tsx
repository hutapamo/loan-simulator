import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ComparisonResult } from '../types/index';
import { formatCurrency } from '../engine/utils';

interface CumulativeInterestChartProps {
  comparison: ComparisonResult;
}

export function CumulativeInterestChart({ comparison }: CumulativeInterestChartProps) {
  const chartData = useMemo(() => {
    try {
      const data = [];
      const maxLength = Math.max(
        comparison.baseline.month_summaries.length,
        comparison.scenario.month_summaries.length
      );

      for (let i = 0; i < maxLength; i++) {
        const baselineSummary = comparison.baseline.month_summaries[i];
        const scenarioSummary = comparison.scenario.month_summaries[i];

        data.push({
          month: i,
          label: baselineSummary ? `${baselineSummary.year}/${baselineSummary.month}` : '',
          baseline: baselineSummary ? baselineSummary.cumulative_interest_paid.toNumber() : null,
          scenario: scenarioSummary ? scenarioSummary.cumulative_interest_paid.toNumber() : null,
        });
      }

      return data;
    } catch (error) {
      return [];
    }
  }, [comparison]);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Cumulative Interest Paid Over Time</h3>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={chartData} margin={{ left: 150, right: 30, top: 10, bottom: 120 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month"
            tick={{ fontSize: 16 }}
            label={{ value: 'Time', position: 'insideBottom', offset: -10, style: { fontSize: 16, fontWeight: 500 } }}
            tickFormatter={(month) => {
              const years = Math.floor(month / 12);
              const months = month % 12;
              if (month === 0) return '0';
              if (months === 0) return `${years}yr`;
              return month % 6 === 0 ? `${years}y${months}m` : '';
            }}
          />
          <YAxis 
            tick={{ fontSize: 16 }}
            tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
            label={{ value: 'Cumulative Interest (R)', angle: -90, position: 'insideLeft', offset: -20, style: { textAnchor: 'middle', fontSize: 16, fontWeight: 500 } }}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(month) => {
              const years = Math.floor(month / 12);
              const months = month % 12;
              return `${years} years ${months} months`;
            }}
          />
          <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px' }} />
          <Line 
            type="monotone" 
            dataKey="baseline" 
            stroke="#9CA3AF" 
            strokeWidth={2}
            name="Baseline"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="scenario" 
            stroke="#EF4444" 
            strokeWidth={2}
            name="With Extras"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
