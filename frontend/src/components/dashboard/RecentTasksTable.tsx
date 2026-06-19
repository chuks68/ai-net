// src/components/dashboard/RecentTasksTable.tsx
import React from 'react';
import { Skeleton } from '../common/Skeleton';
import styles from './RecentTasksTable.module.css';

interface Task {
  id: string;
  status: string;
  createdAt: string; // ISO string
}

interface Props {
  walletAddress: string;
  loading: boolean;
}

export const RecentTasksTable: React.FC<Props> = ({ walletAddress, loading }) => {
  const [tasks, setTasks] = React.useState<Task[]>([]);

  React.useEffect(() => {
    if (!walletAddress) return;
    const fetchTasks = async () => {
      try {
        const res = await fetch(`/api/wallets/${walletAddress}/tasks?limit=5`);
        const data = await res.json();
        setTasks(data);
      } catch (e) {
        console.error(e);
        setTasks([]);
      }
    };
    fetchTasks();
  }, [walletAddress]);

  if (loading) {
    return (
      <div className={styles.table}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.row}>
            <Skeleton width="20%" height="1rem" />
            <Skeleton width="30%" height="1rem" />
            <Skeleton width="30%" height="1rem" />
            <Skeleton width="15%" height="1rem" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return <div className={styles.empty}>No recent tasks for this wallet.</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Task ID</th>
          <th>Status</th>
          <th>Created</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td>{task.id.slice(0, 8)}…</td>
            <td className={styles[task.status.toLowerCase()] || styles.default}>{task.status}</td>
            <td>{new Date(task.createdAt).toLocaleString()}</td>
            <td>
              <a href={`/tasks/${task.id}`} className={styles.viewLink}>View</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
