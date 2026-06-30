import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ExternalLink, Copy, Wallet, Menu, X,
  LayoutDashboard, ClipboardList, Bot, Hammer, UserPlus, CreditCard, Settings,
} from 'lucide-react'
import { useWallet } from '../../context/WalletContext'

const navItems = [
  { label: 'Dashboard', icon: <LayoutDashboard size={16} />, route: '/dashboard' },
  { label: 'Tasks', icon: <ClipboardList size={16} />, route: '/tasks/new' },
  { label: 'Agents', icon: <Bot size={16} />, route: '/agents' },
  { label: 'Builder', icon: <Hammer size={16} />, route: '#' },
  { label: 'Register', icon: <UserPlus size={16} />, route: '#' },
  { label: 'Payments', icon: <CreditCard size={16} />, route: '/wallet' },
  { label: 'Settings', icon: <Settings size={16} />, route: '#' },
]

const Navbar: React.FC = () => {
  const { publicKey, connected, disconnect } = useWallet()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const truncateKey = (key: string) => {
    if (key.length <= 8) return key
    return `${key.slice(0, 4)}...${key.slice(-4)}`
  }

  const copyToClipboard = () => {
    if (publicKey) navigator.clipboard.writeText(publicKey)
  }

  const handleNavClick = (route: string) => {
    if (route === '#') return
    setMobileMenuOpen(false)
    navigate(route)
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 h-[64px] bg-background-primary/80 backdrop-blur-lg border-b border-border-subtle">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-surface transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-[28px] h-[28px] rounded-[7px] bg-gradient-primary flex items-center justify-center font-bold text-white text-sm shadow-[0_0_12px_rgba(56,189,248,0.3)]">
              a
            </div>
            <span className="font-bold text-[15px] text-text-primary tracking-wide hidden sm:inline">
              ai-net
            </span>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="relative flex-1 max-w-[360px] mx-auto sm:mx-0 sm:flex-none sm:w-[280px] hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/60" />
          <input
            type="text"
            placeholder="Search agents, tasks..."
            className="w-full h-9 rounded-full bg-background-surface/60 pl-10 pr-3 text-[13px] text-text-primary placeholder:text-text-secondary/40 outline-none border border-border-subtle focus:border-accent-cyan/50 focus:bg-background-surface transition-all"
          />
        </div>

        {/* Right: Network + Wallet */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-background-surface/60 border border-border-subtle">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[12px] font-semibold text-text-secondary tracking-wide">
              Stellar Testnet
            </span>
          </div>

          {connected && publicKey ? (
            <div className="flex items-center gap-1.5 bg-background-surface/60 border border-border-subtle rounded-full px-3.5 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-[12px] font-medium text-text-primary font-mono tracking-wide">
                {truncateKey(publicKey)}
              </span>
              <button
                onClick={copyToClipboard}
                aria-label="Copy public key"
                className="text-text-secondary/60 hover:text-text-primary transition-colors ml-1"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={disconnect}
                aria-label="Disconnect wallet"
                className="text-text-secondary/60 hover:text-text-primary transition-colors"
              >
                <ExternalLink size={12} />
              </button>
            </div>
          ) : (
            <button className="group flex items-center gap-2 bg-background-surface/60 border border-border-subtle rounded-full px-3.5 py-1.5 cursor-pointer hover:border-accent-cyan/40 hover:bg-background-surface transition-all">
              <Wallet size={14} className="text-accent-cyan" />
              <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary transition-colors hidden sm:inline">
                Connect Wallet
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.nav
              className="relative w-[240px] h-full bg-background-primary border-r border-border-subtle pt-4 px-3 flex flex-col gap-1"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 px-3 pb-4 mb-2 border-b border-border-subtle">
                <div className="w-[28px] h-[28px] rounded-[7px] bg-gradient-primary flex items-center justify-center font-bold text-white text-sm">
                  a
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[14px] leading-tight text-text-primary tracking-wide">
                    ai-net
                  </span>
                  <span className="text-[10px] text-text-secondary tracking-[0.05em]">
                    Agent Network
                  </span>
                </div>
              </div>
              {navItems.map((item, idx) => (
                <button
                  key={idx}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all w-full text-left font-medium ${item.route === '#' ? 'text-text-secondary/40 cursor-not-allowed' : 'text-text-secondary hover:text-text-primary hover:bg-background-surface'}`}
                  onClick={() => handleNavClick(item.route)}
                >
                  <span className="text-text-secondary/60">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Navbar
