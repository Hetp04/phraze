import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: 'none'
      }}>
        <p style={{
          margin: 0,
          color: '#374151',
          fontSize: '12px',
          fontWeight: 500
        }}>
          {payload[0].payload.day}
        </p>
        <p style={{
          margin: '4px 0 0 0',
          color: '#6b7280',
          fontSize: '12px'
        }}>
          annotations : {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const MinimalistAreaChart = ({ data = [] }) => {
  // Define gradient ID (should be unique per component instance)
  const gradientId = `area-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 28, left: 12 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          interval={0}
          angle={0}
          textAnchor="middle"
          type="category"
          padding={{ left: 0, right: 0 }}
        />
        <YAxis hide={true} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#64748b"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default MinimalistAreaChart;
