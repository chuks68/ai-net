import React, { createContext, useContext, useState } from 'react'
import { Keypair } from '@stellar/stellar-sdk'

export class InvalidKeypairError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidKeypairError'
  }
}

interface WalletContextType {
  publicKey: string | null
  keypair: Keypair | null
  connected: boolean
  connect: (secretKey: string) => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    return localStorage.getItem('wallet_pubkey') || localStorage.getItem('walletAddress')
  })
  const [keypair, setKeypair] = useState<Keypair | null>(null)

  const connected = !!publicKey

  const connect = async (secretKey: string) => {
    try {
      const kp = Keypair.fromSecret(secretKey)
      const pubKey = kp.publicKey()
      setKeypair(kp)
      setPublicKey(pubKey)
      localStorage.setItem('wallet_pubkey', pubKey)
      localStorage.setItem('walletAddress', pubKey)
    } catch (error: unknown) {
      throw new InvalidKeypairError(
        error instanceof Error ? error.message : 'Invalid Stellar secret key. Must start with S and be 56 characters.'
      )
    }
  }

  const disconnect = () => {
    setPublicKey(null)
    setKeypair(null)
    localStorage.removeItem('wallet_pubkey')
    localStorage.removeItem('walletAddress')
  }

  React.useEffect(() => {
    const handleDisconnectEvent = () => {
      disconnect()
    }
    window.addEventListener('wallet_disconnected', handleDisconnectEvent)
    return () => {
      window.removeEventListener('wallet_disconnected', handleDisconnectEvent)
    }
  }, [])

  return (
    <WalletContext.Provider value={{ publicKey, keypair, connected, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
