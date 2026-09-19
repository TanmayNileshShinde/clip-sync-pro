import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import {
  Copy,
  Check,
  QrCode,
  Share2,
  X,
  Clock,
  ShieldCheck,
  Flame,
  ArrowRight,
} from 'lucide-react'
import type { ClipItem } from '../types/clipboard'
import { playCopySound, playClickSound } from '../utils/sound'

interface SendSuccessModalProps {
  clip: ClipItem | null
  onClose: () => void
  onSwitchToRetrieve: (code: string) => void
}

export const SendSuccessModal: React.FC<SendSuccessModalProps> = ({
  clip,
  onClose,
  onSwitchToRetrieve,
}) => {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const shareUrl = typeof window !== 'undefined' && clip
    ? `${window.location.origin}/?code=${clip.code}`
    : ''

  // Trigger celebratory confetti on open
  useEffect(() => {
    if (clip) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'],
        })
      } catch {
        // Ignore
      }
    }
  }, [clip])

  // Generate QR Code on canvas
  useEffect(() => {
    if (clip && canvasRef.current && shareUrl) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 180,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch(() => {
        // Ignore QR generation failure
      })
    }
  }, [clip, shareUrl])

  if (!clip) return null

  const handleCopyCode = async () => {
    playCopySound()
    try {
      await navigator.clipboard.writeText(clip.code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleCopyLink = async () => {
    playCopySound()
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // Fallback
    }
  }

  const digits = clip.code.split('')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card success-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="success-badge">
              <Check size={14} /> Ready to Share
            </span>
            <h2>Your Clip is Live!</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => {
              playClickSound()
              onClose()
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 6-Digit Code Box */}
        <div className="code-display-section">
          <span className="code-label">6-Digit Retrieval Code</span>
          <div className="digits-row" onClick={handleCopyCode} title="Click to copy code">
            {digits.map((digit, idx) => (
              <span key={idx} className="digit-box">
                {digit}
              </span>
            ))}
          </div>

          <button
            type="button"
            className={`copy-code-btn ${copiedCode ? 'copied' : ''}`}
            onClick={handleCopyCode}
          >
            {copiedCode ? (
              <>
                <Check size={15} /> Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy size={15} /> Copy 6-Digit Code
              </>
            )}
          </button>
        </div>

        {/* QR Code and Direct Link Grid */}
        <div className="share-methods-grid">
          {/* QR Code */}
          <div className="qr-container">
            <div className="qr-canvas-wrap">
              <canvas ref={canvasRef} className="qr-canvas"></canvas>
            </div>
            <div className="qr-hint">
              <QrCode size={13} />
              <span>Scan with phone camera to open instantly</span>
            </div>
          </div>

          {/* Direct Link */}
          <div className="direct-link-box">
            <span className="link-label">Direct Share Link</span>
            <div className="link-input-group">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="share-link-input"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className={`link-copy-btn ${copiedLink ? 'copied' : ''}`}
                onClick={handleCopyLink}
                title="Copy URL"
              >
                {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
              </button>
            </div>

            {/* Meta Tags */}
            <div className="clip-meta-tags">
              {clip.burnAfterRead && (
                <span className="meta-tag burn">
                  <Flame size={12} /> Burn after read
                </span>
              )}
              {clip.isEncrypted && (
                <span className="meta-tag secure">
                  <ShieldCheck size={12} /> Encrypted (AES-256)
                </span>
              )}
              <span className="meta-tag time">
                <Clock size={12} /> Auto-expires
              </span>
            </div>

            {/* Switch to Retrieve preview */}
            <button
              type="button"
              className="preview-retrieve-btn"
              onClick={() => {
                playClickSound()
                onSwitchToRetrieve(clip.code)
              }}
            >
              <span>Test Retrieve on this device</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-done"
            onClick={() => {
              playClickSound()
              onClose()
            }}
          >
            Done / Send Another
          </button>
        </div>
      </div>
    </div>
  )
}
