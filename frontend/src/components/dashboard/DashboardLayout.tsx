// src/components/dashboard/DashboardLayout.tsx
import React, { ReactNode } from 'react';
import styles from './DashboardLayout.module.css';

interface Props {
  children: ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({ children }) => {
  return <section className={styles.container}>{children}</section>;
};
