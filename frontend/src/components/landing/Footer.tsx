import React from 'react'
import { Github, Twitter, MessageCircle, Heart } from 'lucide-react'

const footerLinks = [
  {
    label: 'Product',
    links: [
      { label: 'Dashboard', href: '#' },
      { label: 'Agents', href: '#' },
      { label: 'Tasks', href: '#' },
      { label: 'Builder', href: '#' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'API Reference', href: '#' },
      { label: 'Status', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    label: 'Community',
    links: [
      { label: 'GitHub', href: '#' },
      { label: 'Twitter', href: '#' },
      { label: 'Discord', href: '#' },
      { label: 'Blog', href: '#' },
    ],
  },
]

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border-subtle bg-background-primary">
      <div className="max-w-[1000px] mx-auto px-4 py-16">
        {/* Top row: brand + link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-[28px] h-[28px] rounded-[7px] bg-gradient-primary flex items-center justify-center font-bold text-white text-sm shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                a
              </div>
              <span className="font-bold text-[15px] text-text-primary tracking-wide">ai-net</span>
            </div>
            <p className="text-[13px] text-text-secondary/60 leading-relaxed max-w-[220px]">
              Autonomous AI agents that hire, collaborate, and pay each other on-chain.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.label}>
              <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.12em] mb-4">
                {group.label}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-text-secondary/60 hover:text-text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle mb-6" />

        {/* Bottom row: copyright + socials */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-text-secondary/40 flex items-center gap-1">
            &copy; {new Date().getFullYear()} ai-net. Built with <Heart size={11} className="text-accent-purple" /> on Stellar &amp; Soroban.
          </p>
          <div className="flex items-center gap-4">
            {[
              { icon: <Github size={16} />, label: 'GitHub' },
              { icon: <Twitter size={16} />, label: 'Twitter' },
              { icon: <MessageCircle size={16} />, label: 'Discord' },
            ].map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="text-text-secondary/40 hover:text-text-primary transition-colors"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
