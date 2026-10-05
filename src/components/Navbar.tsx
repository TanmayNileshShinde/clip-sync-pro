import React from 'react'
import {
  Clipboard,
  History,
  FileText,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react'
import { playClickSound } from '../utils/sound'

interface NavbarProps {
  darkMode: boolean
  setDarkMode: (val: boolean) => void
  soundEnabled: boolean
  setSoundEnabled: (val: boolean) => void
  onOpenHistory: () => void
  onOpenTools: () => void
  historyCount: number
  activeTab: 'send' | 'retrieve'
  setActiveTab: (tab: 'send' | 'retrieve') => void
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  soundEnabled,
  setSoundEnabled,
  onOpenHistory,
  onOpenTools,
  historyCount,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo" onClick={() => setActiveTab('send')} role="button" tabIndex={0}>
          <div className="logo-icon-wrap">
            <Clipboard className="logo-icon" />
          </div>
          <div className="logo-text">
            <span className="brand-name">ClipSync<span className="brand-badge">PRO</span></span>
            <span className="brand-sub">Universal Cross-Device Clipboard</span>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div className="nav-tabs-pill">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('send')
            }}
          >
            <span>↑ Send Clip</span>
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'retrieve' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('retrieve')
            }}
          >
            <span>↓ Retrieve Clip</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="navbar-actions">
          {/* Live Sync Status */}
          <div className="status-badge" title="Live multi-tier sync active">
            <span className="status-dot"></span>
            <Wifi className="status-icon" size={14} />
            <span className="status-text">Live Sync</span>
          </div>

          {/* PDF & Document Tools Button */}
          <button
            type="button"
            className="icon-action-btn pdf-tools-btn"
            onClick={() => {
              playClickSound()
              onOpenTools()
            }}
            title="PDF Tools (Image to PDF, Merge PDF, Text to PDF...)"
            aria-label="PDF Tools"
          >
            <FileText size={18} />
            <span className="action-label">PDF Tools</span>
          </button>

          {/* History Button */}
          <button
            type="button"
            className="icon-action-btn"
            onClick={() => {
              playClickSound()
              onOpenHistory()
            }}
            title="Clip History"
            aria-label="Clip History"
          >
            <History size={18} />
            <span className="action-label">History</span>
            {historyCount > 0 && <span className="badge-count">{historyCount}</span>}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            className="icon-action-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playClickSound()
            }}
            title={soundEnabled ? 'Mute audio feedback' : 'Unmute audio feedback'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="muted-icon" />}
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            className="icon-action-btn theme-toggle"
            onClick={() => {
              playClickSound()
              setDarkMode(!darkMode)
            }}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark/Light Mode"
          >
            {darkMode ? <Sun size={18} className="sun-icon" /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
