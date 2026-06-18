// src/hooks/useWallet.ts
import { useEffect, useState } from 'react';

/** Simple wallet hook – reads wallet address from localStorage (key: "walletAddress"). */
export const useWallet = () => {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('walletAddress');
    if (stored) setAddress(stored);
  }, []);

  return { address };
};
