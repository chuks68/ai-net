// src/services/api.ts
import axios from 'axios';

export const getStats = async () => {
  const { data } = await axios.get('/api/stats');
  return data;
};

export const getRecentTasks = async (walletAddress: string) => {
  const { data } = await axios.get(`/api/wallets/${walletAddress}/tasks?limit=5`);
  return data;
};
