import React, { useState } from 'react'
import {
  X,
  Copy,
  Check,
  Send,
  Wrench,
  Braces,
  Binary,
  Globe,
  Hash,
  Type,
  Sparkles,
} from 'lucide-react'
import { playCopySound, playClickSound, playSuccessSound, playErrorSound } from '../utils/sound'

interface DevToolsModalProps {
  isOpen: boolean
  onClose: () => void
  onSendToClipboard: (text: string) => void
}

type ToolTab = 'json' | 'base64' | 'url' | 'hash' | 'case'

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  isOpen,
  onClose,
  onSendToClipboard,
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('json')
  const [inputVal, setInputVal] = useState('')
  const [outputVal, setOutputVal] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  // JSON Beautify
  const handleJsonBeautify = (indent = 2) => {
    playClickSound()
    try {
      const parsed = JSON.parse(inputVal)
      setOutputVal(JSON.stringify(parsed, null, indent))
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('Invalid JSON: ' + (err as Error).message)
    }
  }

  // JSON Minify
  const handleJsonMinify = () => {
    playClickSound()
    try {
      const parsed = JSON.parse(inputVal)
      setOutputVal(JSON.stringify(parsed))
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('Invalid JSON: ' + (err as Error).message)
    }
  }

  // Base64 Encode
  const handleBase64Encode = () => {
    playClickSound()
    try {
      const encoded = btoa(unescape(encodeURIComponent(inputVal)))
      setOutputVal(encoded)
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('Encoding failed: ' + (err as Error).message)
    }
  }

  // Base64 Decode
  const handleBase64Decode = () => {
    playClickSound()
    try {
      const decoded = decodeURIComponent(escape(atob(inputVal.trim())))
      setOutputVal(decoded)
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('Decoding failed: ' + (err as Error).message)
    }
  }

  // URL Encode
  const handleUrlEncode = () => {
    playClickSound()
    try {
      setOutputVal(encodeURIComponent(inputVal))
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('URL Encode failed: ' + (err as Error).message)
    }
  }

  // URL Decode
  const handleUrlDecode = () => {
    playClickSound()
    try {
      setOutputVal(decodeURIComponent(inputVal))
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('URL Decode failed: ' + (err as Error).message)
    }
  }

  // Hash Generator (SHA-256 / SHA-512)
  const handleHash = async (algo: 'SHA-256' | 'SHA-512') => {
    playClickSound()
    try {
      const enc = new TextEncoder()
      const data = enc.encode(inputVal)
      const hashBuffer = await window.crypto.subtle.digest(algo, data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      setOutputVal(hashHex)
      setErrorMsg(null)
      playSuccessSound()
    } catch (err) {
      playErrorSound()
      setErrorMsg('Hash failed: ' + (err as Error).message)
    }
  }

  // Case Converters
  const handleCaseChange = (type: 'upper' | 'lower' | 'title' | 'camel' | 'snake') => {
    playClickSound()
    let res = inputVal
    if (type === 'upper') {
      res = inputVal.toUpperCase()
    } else if (type === 'lower') {
      res = inputVal.toLowerCase()
    } else if (type === 'title') {
      res = inputVal.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      )
    } else if (type === 'camel') {
      res = inputVal
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    } else if (type === 'snake') {
      res = inputVal
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map((x) => x.toLowerCase())
        .join('_') || inputVal
    }
    setOutputVal(res)
    setErrorMsg(null)
    playSuccessSound()
  }

  const handleCopyOutput = async () => {
    if (!outputVal) return
    playCopySound()
    try {
      await navigator.clipboard.writeText(outputVal)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleSendToClip = () => {
    if (!outputVal) return
    playClickSound()
    onSendToClipboard(outputVal)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card devtools-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="success-badge">
              <Wrench size={14} /> Integrated Utilities
            </span>
            <h2>Developer & Text Tools</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="devtools-tabs">
          <button
            type="button"
            className={`dev-tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('json')
              setOutputVal('')
              setErrorMsg(null)
            }}
          >
            <Braces size={14} /> JSON Tools
          </button>
          <button
            type="button"
            className={`dev-tab ${activeTab === 'base64' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('base64')
              setOutputVal('')
              setErrorMsg(null)
            }}
          >
            <Binary size={14} /> Base64
          </button>
          <button
            type="button"
            className={`dev-tab ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('url')
              setOutputVal('')
              setErrorMsg(null)
            }}
          >
            <Globe size={14} /> URL Encoder
          </button>
          <button
            type="button"
            className={`dev-tab ${activeTab === 'hash' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('hash')
              setOutputVal('')
              setErrorMsg(null)
            }}
          >
            <Hash size={14} /> Hash & Digest
          </button>
          <button
            type="button"
            className={`dev-tab ${activeTab === 'case' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('case')
              setOutputVal('')
              setErrorMsg(null)
            }}
          >
            <Type size={14} /> Case Converter
          </button>
        </div>

        {/* Body Content */}
        <div className="devtools-body">
          {/* Input Area */}
          <div className="dev-io-box">
            <label className="dev-label">Input Data</label>
            <textarea
              rows={4}
              className="styled-textarea code-font"
              placeholder="Paste or type content here..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
          </div>

          {/* Action Buttons for Current Tab */}
          <div className="dev-actions-row">
            {activeTab === 'json' && (
              <>
                <button
                  type="button"
                  className="btn-dev-action"
                  onClick={() => handleJsonBeautify(2)}
                >
                  <Sparkles size={14} /> Beautify (2 spaces)
                </button>
                <button
                  type="button"
                  className="btn-dev-action"
                  onClick={() => handleJsonBeautify(4)}
                >
                  Beautify (4 spaces)
                </button>
                <button type="button" className="btn-dev-action" onClick={handleJsonMinify}>
                  Minify
                </button>
              </>
            )}

            {activeTab === 'base64' && (
              <>
                <button type="button" className="btn-dev-action" onClick={handleBase64Encode}>
                  Encode to Base64
                </button>
                <button type="button" className="btn-dev-action" onClick={handleBase64Decode}>
                  Decode from Base64
                </button>
              </>
            )}

            {activeTab === 'url' && (
              <>
                <button type="button" className="btn-dev-action" onClick={handleUrlEncode}>
                  URL Encode
                </button>
                <button type="button" className="btn-dev-action" onClick={handleUrlDecode}>
                  URL Decode
                </button>
              </>
            )}

            {activeTab === 'hash' && (
              <>
                <button type="button" className="btn-dev-action" onClick={() => handleHash('SHA-256')}>
                  Generate SHA-256
                </button>
                <button type="button" className="btn-dev-action" onClick={() => handleHash('SHA-512')}>
                  Generate SHA-512
                </button>
              </>
            )}

            {activeTab === 'case' && (
              <>
                <button type="button" className="btn-dev-action" onClick={() => handleCaseChange('upper')}>
                  UPPERCASE
                </button>
                <button type="button" className="btn-dev-action" onClick={() => handleCaseChange('lower')}>
                  lowercase
                </button>
                <button type="button" className="btn-dev-action" onClick={() => handleCaseChange('title')}>
                  Title Case
                </button>
                <button type="button" className="btn-dev-action" onClick={() => handleCaseChange('camel')}>
                  camelCase
                </button>
                <button type="button" className="btn-dev-action" onClick={() => handleCaseChange('snake')}>
                  snake_case
                </button>
              </>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && <div className="feedback-alert error">{errorMsg}</div>}

          {/* Output Area */}
          {outputVal && (
            <div className="dev-io-box">
              <div className="dev-output-header">
                <label className="dev-label">Processed Output</label>
                <div className="dev-output-actions">
                  <button
                    type="button"
                    className={`btn-dev-mini ${copied ? 'copied' : ''}`}
                    onClick={handleCopyOutput}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button type="button" className="btn-dev-mini send" onClick={handleSendToClip}>
                    <Send size={13} />
                    <span>Send as Clip</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                readOnly
                className="styled-textarea code-font output-textarea"
                value={outputVal}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
