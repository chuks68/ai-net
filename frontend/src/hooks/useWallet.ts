import { useWallet as useWalletContext } from '../context/WalletContext';

export const useWallet = () => {
  const { publicKey, keypair, connected, connect, disconnect } = useWalletContext();
  return {
    address: publicKey,
    publicKey,
    keypair,
    connected,
    connect,
    disconnect,
  };
};
