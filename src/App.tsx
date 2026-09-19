import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { SendCard } from './components/SendCard'
import { RetrieveCard } from './components/RetrieveCard'
import { SendSuccessModal } from './components/SendSuccessModal'
import { HistoryDrawer } from './components/HistoryDrawer'
import { DevToolsModal } from './components/DevToolsModal'
import { Footer } from './components/Footer'
import type { ClipItem, HistoryItem } from './types/clipboard'
import { getClipHistory, subscribeToCrossTabClips } from './services/clipStore'
import { isSoundEnabled, setSoundEnabled as persistSoundEnabled } from './utils/sound'
import { Sparkles, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

export function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('clipsync_theme')
      if (saved) return saved === 'dark'
    }
    return true // Default dark mode for rich vibrant aesthetics
  })

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(isSoundEnabled)

  // Active view tab (auto-switches to retrieve if code in URL)
  const [activeTab, setActiveTab] = useState<'send' | 'retrieve'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code && code.length === 6) return 'retrieve'
    }
    return 'send'
  })

  // History state directly initialized from localStorage
  const [history, setHistory] = useState<HistoryItem[]>(() => getClipHistory())
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // DevTools modal state
  const [isToolsOpen, setIsToolsOpen] = useState(false)

  // Sent Clip Success modal
  const [createdClip, setCreatedClip] = useState<ClipItem | null>(null)

  // Retrieval code state for passing to RetrieveCard
  const [retrieveCode, setRetrieveCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code && code.length === 6) return code
    }
    return ''
  })

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Show quick toast
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur))
    }, 3500)
  }

  // Apply Theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('clipsync_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Sync sound settings
  useEffect(() => {
    persistSoundEnabled(soundEnabled)
  }, [soundEnabled])

  // Subscribe to Cross-Tab BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToCrossTabClips((clip) => {
      setHistory(getClipHistory())
      showToast(`New clip #${clip.code} synced from another window!`)
    })
    return () => unsubscribe()
  }, [])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHistoryOpen(false)
        setIsToolsOpen(false)
        setCreatedClip(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handler when clip is created
  const handleClipCreated = (clip: ClipItem) => {
    setCreatedClip(clip)
    setHistory(getClipHistory())
  }

  // Handle selecting a code from History or Success Modal
  const handleSelectCode = (code: string) => {
    setRetrieveCode(code)
    setActiveTab('retrieve')
  }

  // Send content from DevTools directly into editor
  const handleSendFromTools = (text: string) => {
    setActiveTab('send')
    // A slight delay ensures component is rendered
    setTimeout(() => {
      const textarea = document.querySelector('.main-textarea') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = text
        // Trigger React change event
        const event = new Event('input', { bubbles: true })
        textarea.dispatchEvent(event)
        textarea.focus()
      }
    }, 100)
    showToast('Sent output from DevTools to clip editor!')
  }

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenTools={() => setIsToolsOpen(true)}
        historyCount={history.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Hub */}
      <main className="main-content">
        {/* Hero Banner */}
        <section className="hero-header">
          <div className="hero-pill-badge">
            <Sparkles size={13} />
            <span>Encrypted • Ephemeral • Cross-Platform</span>
          </div>
          <h1>Universal Cloud Clipboard</h1>
          <p className="hero-subtitle">
            Instantly transfer text snippets, code, screenshots, and files between any phone, laptop,
            or tablet with a 6-digit PIN or QR code.
          </p>
        </section>

        {/* Mobile Tab Switcher (Visible on small screens) */}
        <div className="nav-tabs-pill mobile-tabs" style={{ display: 'none' }}>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => setActiveTab('send')}
          >
            <ArrowUpRight size={14} /> Send
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'retrieve' ? 'active' : ''}`}
            onClick={() => setActiveTab('retrieve')}
          >
            <ArrowDownLeft size={14} /> Retrieve
          </button>
        </div>

        {/* Main Work Panels */}
        {activeTab === 'send' ? (
          <SendCard onClipCreated={handleClipCreated} />
        ) : (
          <RetrieveCard key={retrieveCode} initialCode={retrieveCode} />
        )}
      </main>

      {/* Success Modal with 6-digit PIN, QR Code & Direct Link */}
      <SendSuccessModal
        clip={createdClip}
        onClose={() => setCreatedClip(null)}
        onSwitchToRetrieve={(code) => {
          setCreatedClip(null)
          handleSelectCode(code)
        }}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onHistoryChange={setHistory}
        onSelectCode={handleSelectCode}
      />

      {/* Dev & Text Tools Modal */}
      <DevToolsModal
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        onSendToClipboard={handleSendFromTools}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="feedback-alert info global-toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 300,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* App Footer */}
      <Footer />
    </div>
  )
}

export default App
