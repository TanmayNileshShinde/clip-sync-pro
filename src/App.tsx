import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { SendCard } from './components/SendCard'
import { RetrieveCard } from './components/RetrieveCard'
import { SendSuccessModal } from './components/SendSuccessModal'
import { HistoryDrawer } from './components/HistoryDrawer'
import { DocToolsModal } from './components/DocToolsModal'
import { Footer } from './components/Footer'
import type { ClipItem, HistoryItem } from './types/clipboard'
import { getClipHistory, subscribeToCrossTabClips } from './services/clipStore'
import { isSoundEnabled, setSoundEnabled as persistSoundEnabled } from './utils/sound'
import { Sparkles, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

export function App() {
  // theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('clipsync_theme')
      if (saved) return saved === 'dark'
    }
    return true // Default dark mode for rich vibrant aesthetics
  })

  // sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(isSoundEnabled)

  // active tab
  const [activeTab, setActiveTab] = useState<'send' | 'retrieve'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code && code.length === 6) return 'retrieve'
    }
    return 'send'
  })

  // history state
  const [history, setHistory] = useState<HistoryItem[]>(() => getClipHistory())
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // modal state
  const [isToolsOpen, setIsToolsOpen] = useState(false)

  // success modal
  const [createdClip, setCreatedClip] = useState<ClipItem | null>(null)

  // retrieval code
  const [retrieveCode, setRetrieveCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code && code.length === 6) return code
    }
    return ''
  })
  const [retrieveKey, setRetrieveKey] = useState<number>(0)

  // toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // trigger toast
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur))
    }, 3500)
  }

  // apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('clipsync_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // sound sync
  useEffect(() => {
    persistSoundEnabled(soundEnabled)
  }, [soundEnabled])

  // broadcast channel
  useEffect(() => {
    const unsubscribe = subscribeToCrossTabClips((clip) => {
      setHistory(getClipHistory())
      showToast(`New clip #${clip.code} synced from another window!`)
    })
    return () => unsubscribe()
  }, [])

  // keyboard shortcuts
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

  // clip created
  const handleClipCreated = (clip: ClipItem) => {
    setCreatedClip(clip)
    setHistory(getClipHistory())
  }

  // select code
  const handleSelectCode = (code: string) => {
    setRetrieveCode(code)
    setRetrieveKey((k) => k + 1)
    setActiveTab('retrieve')
    showToast(`Loading clip #${code}...`)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('clipsync:load-code', { detail: code }))
    }, 50)
  }

  // insert content
  const handleSendFromTools = (text: string) => {
    setActiveTab('send')
    // render delay
    setTimeout(() => {
      const textarea = document.querySelector('.main-textarea') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = text
        // trigger change
        const event = new Event('input', { bubbles: true })
        textarea.dispatchEvent(event)
        textarea.focus()
      }
    }, 100)
    showToast('Sent document content to clip editor!')
  }

  // insert file
  const handleSendFileFromTools = (file: File) => {
    setActiveTab('send')
    window.dispatchEvent(new CustomEvent('clipsync:attach-file', { detail: file }))
    showToast(`Attached "${file.name}" to Send card!`)
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
          <RetrieveCard key={`${retrieveCode}_${retrieveKey}`} initialCode={retrieveCode} />
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

      {/* Document & PDF Tools Modal */}
      <DocToolsModal
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        onSendTextToClipboard={handleSendFromTools}
        onSendFileToClipboard={handleSendFileFromTools}
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
