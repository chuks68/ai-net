import React, { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Wallet, Copy, Check, ExternalLink } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useWalletBalance } from '../hooks/useWalletBalance'
import { useTransactionHistory } from '../hooks/useTransactionHistory'
import { SendXLMForm } from '../components/wallet/SendXLMForm'
import { TransactionTable } from '../components/wallet/TransactionTable'
import styles from './WalletPage.module.css'

const STELLAR_EXPLORER = 'https://stellar.expert/explorer/testnet'

function WalletPage() {
  const { publicKey, connected, connect, disconnect } = useWallet()
  const { balance, loading: balanceLoading, error: balanceError } = useWalletBalance(publicKey)
  const { transactions, loading: txLoading, error: txError } = useTransactionHistory(publicKey)
  const [copied, setCopied] = React.useState(false)
  const [secretInput, setSecretInput] = React.useState('')
  const [connectError, setConnectError] = React.useState<string | null>(null)
  const [connecting, setConnecting] = React.useState(false)

  const handleCopyAddress = async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback
        const textArea = document.createElement('textarea')
        textArea.value = publicKey
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnecting(true)
    setConnectError(null)
    try {
      await connect(secretInput.trim())
      setSecretInput('')
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  // Loading skeleton for the balance section
  const balanceDisplay = useMemo(() => {
    if (balanceLoading) {
      return <div className={styles.balanceSkeleton} aria-busy="true" />
    }
    if (balanceError) {
      return <span className={styles.balanceError}>—</span>
    }
    return (
      <span className={styles.balanceAmount}>
        {parseFloat(balance).toFixed(7)}{' '}
        <span className={styles.balanceLabel}>XLM</span>
      </span>
    )
  }, [balance, balanceLoading, balanceError])

  // While not connected, show the connect form
  if (!connected || !publicKey) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Wallet size={24} />
            Wallet
          </h1>
          <p className={styles.subtitle}>Connect your Stellar wallet to get started.</p>
        </div>

        <div className={styles.connectCard}>
          <form onSubmit={handleConnect}>
            <label className={styles.fieldLabel} htmlFor="secret-key-input">
              Stellar Secret Key
            </label>
            <input
              id="secret-key-input"
              className={styles.secretInput}
              type="password"
              placeholder="SABCD...5678"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              aria-describedby="connect-error"
            />
            {connectError && (
              <p id="connect-error" className={styles.error} role="alert">
                {connectError}
              </p>
            )}
            <button
              type="submit"
              className={styles.connectButton}
              disabled={connecting || !secretInput.trim()}
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Wallet size={24} />
          Wallet
        </h1>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceSection}>
          <p className={styles.balanceTitle}>Available Balance</p>
          {balanceDisplay}
        </div>

        <div className={styles.publicKeySection}>
          <div className={styles.qrCode}>
            <QRCodeSVG value={publicKey} size={100} level="M" />
          </div>
          <div className={styles.addressSection}>
            <p className={styles.addressLabel}>Public Key</p>
            <div className={styles.addressRow}>
              <code className={styles.address}>
                {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
              </code>
              <button
                className={styles.iconButton}
                onClick={handleCopyAddress}
                title={copied ? 'Copied!' : 'Copy address'}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <a
                href={`${STELLAR_EXPLORER}/account/${publicKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.iconButton}
                title="View on Stellar Explorer"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.disconnectButton} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className={styles.contentGrid}>
        <div className={styles.sendSection}>
          <SendXLMForm />
        </div>
        <div className={styles.historySection}>
          <TransactionTable
            transactions={transactions}
            loading={txLoading}
            publicKey={publicKey}
          />
          {txError && (
            <p className={styles.error} role="alert">
              Failed to load transaction history: {txError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalletPage
