import React, { useState, useEffect } from 'react'
import {
  Clipboard,
  History,
  FileText,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  Star,
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
  const [starCount, setStarCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('clipsync_stars')
      const parsed = cached ? Number.parseInt(cached, 10) : NaN
      return !Number.isNaN(parsed) && parsed >= 2 ? parsed : 2
    } catch {
      return 2
    }
  })

  useEffect(() => {
    let isMounted = true
    fetch('https://api.github.com/repos/TanmayNileshShinde/clip-sync-pro')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stars')
        return res.json()
      })
      .then((data) => {
        if (isMounted && typeof data?.stargazers_count === 'number') {
          const freshCount = Math.max(data.stargazers_count, 2)
          setStarCount(freshCount)
          try {
            localStorage.setItem('clipsync_stars', String(freshCount))
          } catch {
            // ignore storage errors
          }
        }
      })
      .catch(() => {
        // Silently preserve cached/default count if rate-limited or offline
      })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo" onClick={() => setActiveTab('send')} role="button" tabIndex={0}>
          <div className="logo-icon-wrap">
            <Clipboard className="logo-icon" size={20} />
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

          {/* GitHub Star Button */}
          <a
            href="https://github.com/TanmayNileshShinde/clip-sync-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-action-btn github-star-btn"
            onClick={() => playClickSound()}
            title="Star ClipSync PRO on GitHub"
            aria-label="Star ClipSync PRO on GitHub"
          >
            <Star size={15} className="star-icon" />
            <span className="action-label">Star</span>
            <span className="star-count-badge">{starCount}</span>
          </a>

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
            <FileText size={16} />
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
            <History size={16} />
            <span className="action-label">History</span>
            {historyCount > 0 && <span className="badge-count">{historyCount}</span>}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            className="icon-action-btn sound-toggle"
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playClickSound()
            }}
            title={soundEnabled ? 'Mute audio feedback' : 'Unmute audio feedback'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} className="muted-icon" />}
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
            {darkMode ? <Sun size={17} className="sun-icon" /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  )
}
