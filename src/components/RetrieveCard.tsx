import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Download,
  Copy,
  Check,
  Lock,
  Flame,
  KeyRound,
  FileDown,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileCode,
  Image as ImageIcon,
  ShieldCheck,
  Paperclip,
  ZoomIn,
  FileText,
} from 'lucide-react'
import type { ClipItem, ClipAttachment } from '../types/clipboard'
import { decryptPayload, isEncryptedPayload } from '../utils/crypto'
import { playCopySound, playClickSound, playSuccessSound, playErrorSound } from '../utils/sound'
import { retrieveClip } from '../services/clipStore'
import { isHeicFormat, convertHeicToJpegDataUrl } from '../utils/imageOptimizer'
import { ImageLightboxModal } from './ImageLightboxModal'

interface RetrieveCardProps {
  initialCode?: string
}

export const RetrieveCard: React.FC<RetrieveCardProps> = ({ initialCode = '' }) => {
  const [digits, setDigits] = useState<string[]>(() => {
    let target = initialCode.trim()
    if (!target && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const codeFromUrl = params.get('code')
      if (codeFromUrl && codeFromUrl.length === 6) target = codeFromUrl
    }
    if (target.length === 6) return target.split('')
    return ['', '', '', '', '', '']
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [retrievedClip, setRetrievedClip] = useState<ClipItem | null>(null)
  const [retrievedText, setRetrievedText] = useState<string | null>(null)
  const [retrievedAttachments, setRetrievedAttachments] = useState<ClipAttachment[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [viewFilter, setViewFilter] = useState<'all' | 'photos' | 'text' | 'files'>('all')

  // Password / PIN unlock modal state
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Copy feedback
  const [copiedText, setCopiedText] = useState(false)
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Helper to dynamically convert any received HEIC attachments to JPEG so they preview on all browsers
  const normalizeAttachments = useCallback(async (items: ClipAttachment[]) => {
    const hasHeic = items.some((item) => isHeicFormat(item.name, item.mimeType, item.content))
    if (!hasHeic) return items

    const updated = await Promise.all(
      items.map(async (item) => {
        if (isHeicFormat(item.name, item.mimeType, item.content)) {
          try {
            const jpegDataUrl = await convertHeicToJpegDataUrl(item.content)
            const baseName = item.name.replace(/\.[^/.]+$/, '')
            return {
              ...item,
              name: `${baseName || 'photo'}.jpg`,
              content: jpegDataUrl,
              mimeType: 'image/jpeg',
            }
          } catch (err) {
            console.warn('Failed to convert HEIC preview:', err)
            return item
          }
        }
        return item
      })
    )
    return updated
  }, [])

  // Function to perform retrieval with code string
  const executeRetrieve = useCallback(async (code: string) => {
    if (code.length !== 6 || isNaN(Number(code))) {
      setErrorMsg('Please enter a complete 6-digit numeric code')
      playErrorSound()
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setRetrievedClip(null)
    setRetrievedText(null)
    setRetrievedAttachments([])
    setViewFilter('all')
    setRequiresPassword(false)

    try {
      const clip = await retrieveClip(code)
      setRetrievedClip(clip)

      // Check if clip is encrypted
      if (clip.isEncrypted || isEncryptedPayload(clip.content)) {
        setRequiresPassword(true)
        playClickSound()
      } else {
        setRetrievedText(clip.content || '')
        const list: ClipAttachment[] = clip.attachments && clip.attachments.length > 0
          ? clip.attachments
          : clip.attachment
          ? [clip.attachment]
          : []
        setRetrievedAttachments(list)
        normalizeAttachments(list).then((normalized) => {
          setRetrievedAttachments(normalized)
        })
        playSuccessSound()
      }
    } catch (err: unknown) {
      playErrorSound()
      setErrorMsg((err as Error)?.message || 'No clip found for this code or it has expired')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-fetch if digits complete
  useEffect(() => {
    const code = digits.join('')
    if (code.length === 6 && !digits.includes('')) {
      const timer = setTimeout(() => {
        executeRetrieve(code)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [digits, executeRetrieve])

  // Auto-fill and execute immediately whenever initialCode prop changes
  useEffect(() => {
    const clean = initialCode.trim()
    if (clean.length === 6 && !isNaN(Number(clean))) {
      setDigits(clean.split(''))
      executeRetrieve(clean)
    }
  }, [initialCode, executeRetrieve])

  // Global event listener for loading code dynamically from History
  useEffect(() => {
    const handleLoadCode = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      const clean = customEvent.detail?.trim()
      if (clean && clean.length === 6 && !isNaN(Number(clean))) {
        setDigits(clean.split(''))
        executeRetrieve(clean)
      }
    }
    window.addEventListener('clipsync:load-code', handleLoadCode)
    return () => window.removeEventListener('clipsync:load-code', handleLoadCode)
  }, [executeRetrieve])

  // Handle Digit Change
  const handleDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6)
      if (cleaned) {
        const newDigits = [...digits]
        for (let i = 0; i < 6; i++) {
          newDigits[i] = cleaned[i] || ''
        }
        setDigits(newDigits)
        if (cleaned.length === 6) {
          executeRetrieve(cleaned)
        } else {
          inputRefs.current[Math.min(cleaned.length, 5)]?.focus()
        }
        return
      }
    }

    const digit = val.slice(-1).replace(/\D/g, '')
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    const fullCode = newDigits.join('')
    if (fullCode.length === 6 && !newDigits.includes('')) {
      executeRetrieve(fullCode)
    }
  }

  // Handle Backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Decrypt with user password
  const handleDecrypt = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter the password')
      playErrorSound()
      return
    }

    if (!retrievedClip) return

    try {
      const plaintext = await decryptPayload(retrievedClip.content, passwordInput.trim())

      // Check if decrypted payload is structured JSON (text + attachments)
      try {
        const parsed = JSON.parse(plaintext)
        let list: ClipAttachment[] = []
        if (parsed && (typeof parsed.text === 'string' || parsed.attachments || parsed.attachment)) {
          setRetrievedText(parsed.text || '')
          list = parsed.attachments && parsed.attachments.length > 0
            ? parsed.attachments
            : parsed.attachment
            ? [parsed.attachment]
            : []
        } else {
          setRetrievedText(plaintext)
          list = retrievedClip.attachments || (retrievedClip.attachment ? [retrievedClip.attachment] : [])
        }
        setRetrievedAttachments(list)
        normalizeAttachments(list).then((normalized) => {
          setRetrievedAttachments(normalized)
        })
      } catch {
        setRetrievedText(plaintext)
        const fallbackList = retrievedClip.attachments || (retrievedClip.attachment ? [retrievedClip.attachment] : [])
        setRetrievedAttachments(fallbackList)
        normalizeAttachments(fallbackList).then((normalized) => {
          setRetrievedAttachments(normalized)
        })
      }

      setRequiresPassword(false)
      setPasswordError(null)
      playSuccessSound()
    } catch {
      setPasswordError('Incorrect password or PIN. Decryption failed.')
      playErrorSound()
    }
  }

  // Copy text to clipboard
  const handleCopyText = async () => {
    if (!retrievedText) return
    playCopySound()
    try {
      await navigator.clipboard.writeText(retrievedText)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Copy Image to clipboard
  const handleCopyImage = async (item: ClipAttachment, idOrIdx: string) => {
    if (!item?.content) return
    playCopySound()
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const response = await fetch(item.content)
        const blob = await response.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || 'image/png']: blob }),
        ])
        setCopiedImageId(idOrIdx)
        setTimeout(() => setCopiedImageId(null), 2000)
      } else {
        await navigator.clipboard.writeText(item.content)
        setCopiedImageId(idOrIdx)
        setTimeout(() => setCopiedImageId(null), 2000)
      }
    } catch {
      // Fallback
    }
  }

  // Download Attachment
  const handleDownloadAttachment = (item: ClipAttachment) => {
    if (!item?.content) return
    playClickSound()
    const link = document.createElement('a')
    link.href = item.content
    link.download = item.name || `attachment_${Date.now()}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download All Attachments
  const handleDownloadAll = () => {
    playClickSound()
    retrievedAttachments.forEach((item, i) => {
      setTimeout(() => {
        handleDownloadAttachment(item)
      }, i * 200)
    })
  }

  // Download Text as .txt
  const handleDownloadText = () => {
    if (!retrievedText) return
    playClickSound()
    const blob = new Blob([retrievedText], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clip_${retrievedClip?.code || 'text'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Clear / Reset
  const handleReset = () => {
    playClickSound()
    setDigits(['', '', '', '', '', ''])
    setRetrievedClip(null)
    setRetrievedText(null)
    setRetrievedAttachments([])
    setErrorMsg(null)
    setRequiresPassword(false)
    setPasswordInput('')
    inputRefs.current[0]?.focus()
  }

  const hasData = Boolean(retrievedText) || retrievedAttachments.length > 0
  const imageAttachments = retrievedAttachments.filter((a) => a.mimeType.startsWith('image/'))
  const otherFiles = retrievedAttachments.filter((a) => !a.mimeType.startsWith('image/'))
  const hasMultipleTypes =
    (retrievedText ? 1 : 0) +
    (imageAttachments.length > 0 ? 1 : 0) +
    (otherFiles.length > 0 ? 1 : 0) > 1

  return (
    <div className="glass-card retrieve-card">
      <div className="retrieve-header-banner">
        <KeyRound className="header-key-icon" size={24} />
        <div>
          <h3>Enter 6-Digit Retrieval Code</h3>
          <p>Retrieve text notes, code, photos, and files sent from any device</p>
        </div>
      </div>

      {/* Segmented 6-digit input boxes */}
      <div className="digits-input-wrapper">
        <div className="digits-boxes-row">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={`digit-cell ${digit ? 'filled' : ''}`}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              placeholder="•"
            />
          ))}
        </div>

        <div className="retrieve-btn-group">
          <button
            type="button"
            className="btn-retrieve-action"
            disabled={isLoading || digits.join('').length !== 6}
            onClick={() => executeRetrieve(digits.join(''))}
          >
            {isLoading ? (
              <>
                <span className="btn-spinner"></span>
                <span>Searching Cloud...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Retrieve Clip</span>
              </>
            )}
          </button>

          {(digits.some((d) => d !== '') || retrievedClip) && (
            <button type="button" className="btn-retrieve-clear" onClick={handleReset}>
              <RefreshCw size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="feedback-alert error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Password Required Unlock Box */}
      {requiresPassword && (
        <div className="unlock-container">
          <div className="unlock-header">
            <Lock size={18} className="lock-icon-bounce" />
            <div>
              <h4>Clip is Password Protected</h4>
              <p>Enter the encryption password or PIN set by the sender to view</p>
            </div>
          </div>

          <div className="unlock-input-row">
            <input
              type="password"
              className="styled-input unlock-input"
              placeholder="Enter PIN / password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
              autoFocus
            />
            <button type="button" className="btn-unlock-confirm" onClick={handleDecrypt}>
              Decrypt
            </button>
          </div>

          {passwordError && (
            <span className="error-text">
              <AlertCircle size={13} /> {passwordError}
            </span>
          )}
        </div>
      )}

      {/* Retrieved Result Display */}
      {retrievedClip && hasData && (
        <div className="retrieved-content-card">
          {/* Status and Meta Bar */}
          <div className="content-meta-bar">
            <div className="type-badge-indicator">
              {retrievedAttachments.length > 0 && retrievedText ? (
                <>
                  <Paperclip size={15} />
                  <span>Text + {retrievedAttachments.length} Attachment(s)</span>
                </>
              ) : retrievedClip.type === 'code' ? (
                <>
                  <FileCode size={15} />
                  <span>Code Snippet</span>
                </>
              ) : imageAttachments.length > 0 ? (
                <>
                  <ImageIcon size={15} />
                  <span>{imageAttachments.length} Photo{imageAttachments.length > 1 ? 's' : ''}</span>
                </>
              ) : otherFiles.length > 0 ? (
                <>
                  <Paperclip size={15} />
                  <span>{otherFiles.length} File{otherFiles.length > 1 ? 's' : ''}</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Text Note</span>
                </>
              )}
            </div>

            <div className="retrieved-badges">
              {retrievedClip.isEncrypted && (
                <span className="badge-pill secure">
                  <ShieldCheck size={12} /> Decrypted
                </span>
              )}
              {retrievedClip.burnAfterRead && (
                <span className="badge-pill burned">
                  <Flame size={12} /> Burned on read (Self-destructed)
                </span>
              )}
            </div>
          </div>

          {/* Interactive View Filter Tabs (shown when clip contains mixed content) */}
          {hasMultipleTypes && (
            <div className="retrieved-filter-bar">
              <button
                type="button"
                className={`retrieved-filter-btn ${viewFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  playClickSound()
                  setViewFilter('all')
                }}
              >
                <Sparkles size={13} />
                <span>All Content</span>
              </button>

              {imageAttachments.length > 0 && (
                <button
                  type="button"
                  className={`retrieved-filter-btn ${viewFilter === 'photos' ? 'active' : ''}`}
                  onClick={() => {
                    playClickSound()
                    setViewFilter('photos')
                  }}
                >
                  <ImageIcon size={13} />
                  <span>Photos ({imageAttachments.length})</span>
                </button>
              )}

              {otherFiles.length > 0 && (
                <button
                  type="button"
                  className={`retrieved-filter-btn ${viewFilter === 'files' ? 'active' : ''}`}
                  onClick={() => {
                    playClickSound()
                    setViewFilter('files')
                  }}
                >
                  <Paperclip size={13} />
                  <span>Files ({otherFiles.length})</span>
                </button>
              )}

              {retrievedText && (
                <button
                  type="button"
                  className={`retrieved-filter-btn ${viewFilter === 'text' ? 'active' : ''}`}
                  onClick={() => {
                    playClickSound()
                    setViewFilter('text')
                  }}
                >
                  <FileText size={13} />
                  <span>Note / Code</span>
                </button>
              )}
            </div>
          )}

          {/* Content Body: Media & Photos on TOP, Text below */}
          <div className="content-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Photo Gallery Section (Rendered FIRST so images are immediately visible!) */}
            {imageAttachments.length > 0 && (viewFilter === 'all' || viewFilter === 'photos') && (
              <div className="retrieved-gallery-block">
                <div className="gallery-header-row" style={{ marginBottom: '0.75rem' }}>
                  <span className="gallery-title-text">
                    <ImageIcon size={15} /> Photos ({imageAttachments.length})
                  </span>
                  {imageAttachments.length > 1 && (
                    <button
                      type="button"
                      className="btn-download-all"
                      onClick={handleDownloadAll}
                      title="Download all attachments"
                    >
                      <Download size={13} /> Download All ({imageAttachments.length})
                    </button>
                  )}
                </div>

                <div className="retrieved-images-grid">
                  {imageAttachments.map((img, idx) => (
                    <div key={idx} className="retrieved-image-item">
                      <div
                        className="retrieved-thumb-box"
                        onClick={() => setLightboxIndex(idx)}
                        title="Click to view full image in Lightbox"
                      >
                        <img src={img.content} alt={img.name} className="gallery-img-display" />
                        <div className="thumb-zoom-badge">
                          <ZoomIn size={16} />
                        </div>
                      </div>

                      <div className="img-item-meta">
                        <span className="img-name-title">{img.name}</span>
                        <span className="img-size-sub">{(img.size / 1024).toFixed(1)} KB</span>
                      </div>

                      <div className="img-item-buttons">
                        <button
                          type="button"
                          className={`btn-action-mini ${copiedImageId === String(idx) ? 'copied' : ''}`}
                          onClick={() => handleCopyImage(img, String(idx))}
                          title="Copy image to clipboard"
                        >
                          {copiedImageId === String(idx) ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedImageId === String(idx) ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-action-mini"
                          onClick={() => handleDownloadAttachment(img)}
                          title="Download photo"
                        >
                          <Download size={13} />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Non-image Files Section (Rendered SECOND) */}
            {otherFiles.length > 0 && (viewFilter === 'all' || viewFilter === 'files') && (
              <div
                className="retrieved-files-block"
                style={{
                  borderTop: imageAttachments.length > 0 && viewFilter === 'all' ? '1px solid var(--card-border)' : 'none',
                  paddingTop: imageAttachments.length > 0 && viewFilter === 'all' ? '1rem' : '0',
                }}
              >
                <div className="gallery-title-text" style={{ marginBottom: '0.65rem' }}>
                  <Paperclip size={15} /> Attached Files ({otherFiles.length})
                </div>

                <div className="files-list-col">
                  {otherFiles.map((file, idx) => (
                    <div key={idx} className="retrieved-file-row">
                      <FileDown size={28} className="file-icon" />
                      <div className="file-info-col" style={{ flex: 1 }}>
                        <span className="file-title">{file.name}</span>
                        <span className="file-sub">{(file.size / 1024).toFixed(1)} KB • {file.mimeType}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-action-primary"
                        onClick={() => handleDownloadAttachment(file)}
                      >
                        <Download size={15} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Text / Code Section (Rendered THIRD with contained scrollable text-display-box) */}
            {retrievedText && (viewFilter === 'all' || viewFilter === 'text') && (
              <div
                className="retrieved-text-block"
                style={{
                  borderTop: (imageAttachments.length > 0 || otherFiles.length > 0) && viewFilter === 'all' ? '1px solid var(--card-border)' : 'none',
                  paddingTop: (imageAttachments.length > 0 || otherFiles.length > 0) && viewFilter === 'all' ? '1rem' : '0',
                }}
              >
                {(imageAttachments.length > 0 || otherFiles.length > 0) && viewFilter === 'all' && (
                  <div className="gallery-header-row" style={{ marginBottom: '0.65rem' }}>
                    <span className="gallery-title-text">
                      <FileText size={15} /> Note / Code
                    </span>
                  </div>
                )}

                <div className="text-display-box">
                  <pre className={`pre-content ${retrievedClip.type === 'code' ? 'code-view' : ''}`}>
                    <code>{retrievedText}</code>
                  </pre>
                </div>
                <div className="content-actions-bar" style={{ marginTop: '0.5rem', background: 'transparent' }}>
                  <button
                    type="button"
                    className={`btn-action-primary ${copiedText ? 'success' : ''}`}
                    onClick={handleCopyText}
                  >
                    {copiedText ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedText ? 'Text Copied!' : 'Copy Text'}</span>
                  </button>
                  <button type="button" className="btn-action-secondary" onClick={handleDownloadText}>
                    <Download size={15} /> Save as .txt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal for Image Inspection */}
      {lightboxIndex !== null && imageAttachments.length > 0 && (
        <ImageLightboxModal
          isOpen={true}
          images={imageAttachments}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
