// src/components/dashboard/NetworkHealthBadge.tsx
import React from 'react';
import styles from './NetworkHealthBadge.module.css';

interface Props {
  uptimePercent: number;
}

export const NetworkHealthBadge: React.FC<Props> = ({ uptimePercent }) => {
  let colorClass = styles.red;
  if (uptimePercent >= 99) colorClass = styles.green;
  else if (uptimePercent >= 95) colorClass = styles.yellow;
  return (
    <div className={styles.container}>
      <span className={`${styles.dot} ${colorClass}`} />
      <span className={styles.label}>{uptimePercent.toFixed(2)}%</span>
    </div>
  );
};
