// src/components/dashboard/KpiCard.tsx
import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: number | string;
  sparklineData: number[]; // array of values for chart
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, sparklineData, loading }) => {
  const data = sparklineData.map((v, i) => ({ x: i, y: v }));
  return (
    <div className={styles.card}>
      {loading ? (
        <div className={styles.skeleton} />
      ) : (
        <>
          <div className={styles.title}>{title}</div>
          <div className={styles.value}>{value}</div>
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};
