import React from 'react'
import { useWallet } from '../context/WalletContext'

const WalletPage: React.FC = () => {
  const { publicKey, connected, disconnect } = useWallet()

  return (
    <div>
      <h1>Wallet</h1>
      <p>Manage your Stellar wallet connection.</p>
      
      {connected ? (
        <div>
          <p>Connected with public key: {publicKey}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <p>No wallet connected</p>
      )}
    </div>
  )
}

export default WalletPage
