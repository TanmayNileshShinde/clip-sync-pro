import React from 'react'
import { ShieldCheck, Zap, Sparkles, Command } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      {/* Keyboard Shortcuts Hint Bar */}
      <div className="shortcuts-bar">
        <div className="shortcut-item">
          <Command size={13} className="shortcut-icon" />
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
          <span>Send clip</span>
        </div>
        <div className="shortcut-divider">•</div>
        <div className="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>V</kbd>
          <span>Paste image or text anywhere</span>
        </div>
        <div className="shortcut-divider">•</div>
        <div className="shortcut-item">
          <kbd>Esc</kbd>
          <span>Close / Clear</span>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="footer-highlights">
        <div className="highlight-pill">
          <Zap size={14} className="highlight-icon zap" />
          <span>Sub-10ms Instant Sync</span>
        </div>
        <div className="highlight-pill">
          <ShieldCheck size={14} className="highlight-icon shield" />
          <span>Client-Side AES-256 E2EE</span>
        </div>
        <div className="highlight-pill">
          <Sparkles size={14} className="highlight-icon star" />
          <span>Zero Ads &amp; No CPU Mining</span>
        </div>
      </div>

      {/* Copyright and links */}
      <div className="footer-meta">
        <p>
          &copy; 2026 <strong>ClipSync PRO</strong> &middot; Fast, Private, Cross-Device Temporary Shared Clipboard
        </p>
      </div>
    </footer>
  )
}
