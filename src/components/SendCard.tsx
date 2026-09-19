import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileText,
  Code2,
  Image as ImageIcon,
  FileUp,
  ClipboardPaste,
  Trash2,
  Lock,
  Flame,
  Clock,
  Sparkles,
  UploadCloud,
  Check,
  AlertCircle,
  Braces,
  X,
  ZoomIn,
  Plus,
} from 'lucide-react'
import type { ClipItem, ClipType, ClipAttachment } from '../types/clipboard'
import { encryptPayload } from '../utils/crypto'
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound'
import { generateRandomCode, sendClip } from '../services/clipStore'
import { ImageLightboxModal } from './ImageLightboxModal'

interface SendCardProps {
  onClipCreated: (clip: ClipItem) => void
}

export const SendCard: React.FC<SendCardProps> = ({ onClipCreated }) => {
  const [clipType, setClipType] = useState<ClipType>('text')
  const [textContent, setTextContent] = useState('')
  const [attachments, setAttachments] = useState<ClipAttachment[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [burnAfterRead, setBurnAfterRead] = useState(false)
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [password, setPassword] = useState('')
  const [expiryHours, setExpiryHours] = useState<number>(24) // 24 hours default

  const [isLoading, setIsLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Show temporary feedback message
  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackMessage({ text, type })
    setTimeout(() => {
      setFeedbackMessage((current) => (current?.text === text ? null : current))
    }, 4000)
  }

  // Process a single or multiple Files
  const processFiles = useCallback((files: FileList | File[]) => {
    let totalAdded = 0

    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        showFeedback(`"${file.name}" exceeds 25MB limit. Skipped.`, 'error')
        return
      }

      const isImg = file.type.startsWith('image/')
      const reader = new FileReader()

      reader.onload = () => {
        const result = reader.result as string
        const item: ClipAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          content: result,
          name: file.name,
          size: file.size,
          mimeType: file.type || (isImg ? 'image/png' : 'application/octet-stream'),
        }

        setAttachments((prev) => [...prev, item])
        totalAdded++
      }

      reader.onerror = () => {
        showFeedback(`Failed to read "${file.name}"`, 'error')
      }

      reader.readAsDataURL(file)
    })

    setTimeout(() => {
      if (totalAdded > 0) {
        playSuccessSound()
        showFeedback(`Attached ${totalAdded} item${totalAdded > 1 ? 's' : ''}!`, 'success')
      }
    }, 200)
  }, [])

  // Listen for global Ctrl+V paste (allows pasting multiple screenshots/images anytime!)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') return

      const items = e.clipboardData?.items
      if (!items) return

      const pastedFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            pastedFiles.push(blob)
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault()
        processFiles(pastedFiles)
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [processFiles])

  // Read System Clipboard via Button
  const handleReadClipboard = async () => {
    playClickSound()
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read()
        const imageFiles: File[] = []

        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const file = new File([blob], `screenshot_${Date.now()}.png`, { type: imageType })
            imageFiles.push(file)
          }
        }

        if (imageFiles.length > 0) {
          processFiles(imageFiles)
          return
        }
      }

      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setTextContent((prev) => (prev ? `${prev}\n\n${text}` : text))
          showFeedback('Pasted text from clipboard!', 'success')
          playSuccessSound()
          return
        }
      }
      showFeedback('Clipboard is empty or unsupported format', 'info')
    } catch {
      showFeedback('Clipboard permission denied. Please paste manually (Ctrl+V)', 'error')
      playErrorSound()
    }
  }

  // Prettify JSON helper
  const handlePrettifyJSON = () => {
    playClickSound()
    try {
      const parsed = JSON.parse(textContent)
      setTextContent(JSON.stringify(parsed, null, 2))
      setClipType('code')
      showFeedback('Formatted JSON successfully!', 'success')
      playSuccessSound()
    } catch {
      showFeedback('Text is not valid JSON', 'error')
      playErrorSound()
    }
  }

  // Remove individual attachment
  const handleRemoveAttachment = (idOrIdx: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    setAttachments((prev) =>
      typeof idOrIdx === 'string'
        ? prev.filter((item) => item.id !== idOrIdx)
        : prev.filter((_, idx) => idx !== idOrIdx)
    )
  }

  // Clear all inputs
  const handleClear = () => {
    playClickSound()
    setTextContent('')
    setAttachments([])
    setLightboxIndex(null)
    setFeedbackMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // Handle Send Clip
  const handleSend = async () => {
    if (!textContent.trim() && attachments.length === 0) {
      playErrorSound()
      showFeedback('Please write text, paste code, or attach at least one photo/file.', 'error')
      textareaRef.current?.focus()
      return
    }

    if (isEncrypted && !password.trim()) {
      playErrorSound()
      showFeedback('Please enter a password or PIN to encrypt this clip.', 'error')
      return
    }

    setIsLoading(true)

    try {
      const code = generateRandomCode()
      const hasText = !!textContent.trim()
      const hasAttachments = attachments.length > 0

      let effectiveType: ClipType = 'text'
      if (hasText && hasAttachments) {
        effectiveType = 'mixed'
      } else if (hasAttachments) {
        const allImages = attachments.every((a) => a.mimeType.startsWith('image/'))
        effectiveType = allImages ? 'image' : 'file'
      } else {
        effectiveType = clipType
      }

      let contentToSend = textContent.trim()
      let attachmentsToSend: ClipAttachment[] | undefined = hasAttachments ? attachments : undefined

      // If user enabled password encryption, encrypt text and all attachments together
      if (isEncrypted && password.trim()) {
        const payloadObject = {
          text: contentToSend,
          attachments: attachmentsToSend,
        }
        contentToSend = await encryptPayload(JSON.stringify(payloadObject), password.trim())
        attachmentsToSend = undefined // Nested safely in encrypted payload
      }

      const expiresAt = expiryHours > 0 ? Date.now() + expiryHours * 60 * 60 * 1000 : 0

      const primaryAttachment = attachments[0]

      const newClip = await sendClip({
        code,
        type: effectiveType,
        content: contentToSend,
        attachments: attachmentsToSend,
        attachment: primaryAttachment, // backward compatibility
        name: primaryAttachment?.name,
        size: attachments.reduce((acc, curr) => acc + (curr.size || 0), 0),
        mimeType: primaryAttachment?.mimeType,
        isEncrypted,
        burnAfterRead,
        expiresAt,
      })

      playSuccessSound()
      onClipCreated(newClip)
    } catch (err: unknown) {
      playErrorSound()
      showFeedback((err as Error)?.message || 'Failed to send clip. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Keyboard shortcut: Ctrl+Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // Drag and Drop handlers (supports multiple files at once!)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }

  const charCount = textContent.length
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0
  const lineCount = textContent ? textContent.split('\n').length : 0

  // Total attachment size
  const totalAttachmentBytes = attachments.reduce((acc, curr) => acc + (curr.size || 0), 0)

  // Filter image attachments for Lightbox preview
  const imageAttachments = attachments.filter((a) => a.mimeType.startsWith('image/'))

  return (
    <div
      className={`glass-card send-card ${isDragging ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Type & Multi-Attachment Selector Pills */}
      <div className="type-pills-row">
        <button
          type="button"
          className={`type-pill ${clipType === 'text' ? 'active' : ''}`}
          onClick={() => {
            playClickSound()
            setClipType('text')
          }}
        >
          <FileText size={15} />
          <span>Text / Note</span>
        </button>

        <button
          type="button"
          className={`type-pill ${clipType === 'code' ? 'active' : ''}`}
          onClick={() => {
            playClickSound()
            setClipType('code')
          }}
        >
          <Code2 size={15} />
          <span>Code Snippet</span>
        </button>

        {/* Attach Multiple Photos button */}
        <button
          type="button"
          className={`type-pill ${attachments.some((a) => a.mimeType.startsWith('image/')) ? 'active' : ''}`}
          onClick={() => {
            playClickSound()
            imageInputRef.current?.click()
          }}
          title="Select one or multiple photos to attach"
        >
          <ImageIcon size={15} />
          <span>
            {attachments.filter((a) => a.mimeType.startsWith('image/')).length > 0
              ? `${attachments.filter((a) => a.mimeType.startsWith('image/')).length} Photo(s) Attached`
              : '+ Attach Photos'}
          </span>
        </button>

        {/* Attach Files button */}
        <button
          type="button"
          className={`type-pill ${attachments.some((a) => !a.mimeType.startsWith('image/')) ? 'active' : ''}`}
          onClick={() => {
            playClickSound()
            fileInputRef.current?.click()
          }}
          title="Select one or multiple files to attach"
        >
          <FileUp size={15} />
          <span>
            {attachments.filter((a) => !a.mimeType.startsWith('image/')).length > 0
              ? `${attachments.filter((a) => !a.mimeType.startsWith('image/')).length} File(s) Attached`
              : '+ Attach Files'}
          </span>
        </button>

        {/* Hidden File Inputs with 'multiple' enabled */}
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFiles(e.target.files)
            }
          }}
        />
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFiles(e.target.files)
            }
          }}
        />
      </div>

      {/* Main Input Area: Textarea is ALWAYS available */}
      <div className="input-container">
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            className={`main-textarea ${clipType === 'code' ? 'code-font' : ''}`}
            rows={attachments.length > 0 ? 4 : 7}
            placeholder={
              clipType === 'code'
                ? 'Write or paste code here... (you can attach as many photos or files as you want below!)'
                : 'Write your text or note here... (you can attach as many photos or files as you want below!)'
            }
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />

          {/* Micro Quick Bar inside textarea bottom */}
          <div className="textarea-footer-bar">
            <div className="stats-badges">
              <span>{charCount} chars</span>
              <span>•</span>
              <span>{wordCount} words</span>
              {lineCount > 1 && (
                <>
                  <span>•</span>
                  <span>{lineCount} lines</span>
                </>
              )}
            </div>

            <div className="footer-quick-actions">
              {textContent.trim().startsWith('{') || textContent.trim().startsWith('[') ? (
                <button
                  type="button"
                  className="micro-action-btn"
                  onClick={handlePrettifyJSON}
                  title="Format JSON"
                >
                  <Braces size={13} /> Format JSON
                </button>
              ) : null}

              <button
                type="button"
                className="micro-action-btn"
                onClick={handleReadClipboard}
                title="Paste from system clipboard"
              >
                <ClipboardPaste size={13} /> Paste Clipboard
              </button>

              {(textContent || attachments.length > 0) && (
                <button
                  type="button"
                  className="micro-action-btn danger"
                  onClick={handleClear}
                  title="Clear everything"
                >
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Attachment Gallery Row */}
        {attachments.length > 0 && (
          <div className="attachments-gallery-panel">
            <div className="gallery-header-row">
              <span className="gallery-count-tag">
                {attachments.length} attachment{attachments.length > 1 ? 's' : ''} ({(totalAttachmentBytes / 1024).toFixed(1)} KB total)
              </span>
              <button
                type="button"
                className="btn-text-danger"
                onClick={() => {
                  playClickSound()
                  setAttachments([])
                }}
              >
                <Trash2 size={13} /> Remove all
              </button>
            </div>

            <div className="gallery-thumbnails-grid">
              {attachments.map((item, idx) => {
                const isImage = item.mimeType.startsWith('image/')
                const imgIdx = imageAttachments.findIndex((a) => a === item)

                return (
                  <div
                    key={item.id || idx}
                    className="gallery-thumb-card"
                    onClick={() => {
                      if (isImage && imgIdx !== -1) {
                        setLightboxIndex(imgIdx)
                      }
                    }}
                    title={isImage ? 'Click to inspect full resolution' : item.name}
                  >
                    {isImage ? (
                      <div className="thumb-img-box">
                        <img src={item.content} alt="Preview" className="gallery-img" />
                        <div className="thumb-zoom-overlay">
                          <ZoomIn size={14} />
                        </div>
                      </div>
                    ) : (
                      <div className="thumb-file-box">
                        <FileUp size={24} />
                      </div>
                    )}

                    <div className="thumb-meta-col">
                      <span className="thumb-filename-text">{item.name}</span>
                      <span className="thumb-size-text">{(item.size / 1024).toFixed(1)} KB</span>
                    </div>

                    {/* Dedicated Individual X button */}
                    <button
                      type="button"
                      className="btn-remove-thumb"
                      onClick={(e) => handleRemoveAttachment(item.id || idx, e)}
                      title={`Remove ${item.name}`}
                      aria-label="Remove photo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}

              {/* Add More Photos / Files Button */}
              <button
                type="button"
                className="btn-add-more-chip"
                onClick={() => {
                  playClickSound()
                  imageInputRef.current?.click()
                }}
                title="Add more photos or files"
              >
                <Plus size={18} />
                <span>Add More</span>
              </button>
            </div>
          </div>
        )}

        {/* Drag Over Hint */}
        {isDragging && (
          <div className="drag-overlay">
            <UploadCloud size={48} className="pulse-icon" />
            <p>Drop photos or files here to attach all of them</p>
          </div>
        )}
      </div>

      {/* Security & Expiration Options Row */}
      <div className="options-panel">
        <div className="option-item">
          <label className="toggle-switch-label" title="Self-destruct after first retrieval">
            <input
              type="checkbox"
              checked={burnAfterRead}
              onChange={(e) => {
                playClickSound()
                setBurnAfterRead(e.target.checked)
              }}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">
              <Flame size={14} className={burnAfterRead ? 'flame-active' : ''} /> Burn after read
            </span>
          </label>
        </div>

        <div className="option-item">
          <label className="toggle-switch-label" title="Protect with AES-GCM 256 encryption">
            <input
              type="checkbox"
              checked={isEncrypted}
              onChange={(e) => {
                playClickSound()
                setIsEncrypted(e.target.checked)
              }}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">
              <Lock size={14} className={isEncrypted ? 'lock-active' : ''} /> Password protect
            </span>
          </label>
        </div>

        {/* Expiry Selector */}
        <div className="option-item expiry-select-wrap">
          <Clock size={14} className="option-icon" />
          <select
            value={expiryHours}
            onChange={(e) => {
              playClickSound()
              setExpiryHours(Number(e.target.value))
            }}
            className="expiry-select"
            title="Clip Lifespan"
          >
            <option value={1 / 12}>Expires in 5 minutes</option>
            <option value={1}>Expires in 1 hour</option>
            <option value={24}>Expires in 24 hours</option>
            <option value={168}>Expires in 7 days</option>
          </select>
        </div>
      </div>

      {/* Password input if encryption is enabled */}
      {isEncrypted && (
        <div className="password-input-row">
          <div className="password-field">
            <Lock size={15} className="field-icon" />
            <input
              type="password"
              placeholder="Enter PIN or password to unlock this clip..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="styled-input"
            />
          </div>
          <span className="password-hint">
            End-to-end encrypted with AES-256 in your browser before transfer.
          </span>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className={`feedback-alert ${feedbackMessage.type}`}>
          {feedbackMessage.type === 'success' && <Check size={16} />}
          {feedbackMessage.type === 'error' && <AlertCircle size={16} />}
          {feedbackMessage.type === 'info' && <Sparkles size={16} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Primary Action Button */}
      <div className="send-action-row">
        <button
          type="button"
          className="btn-primary-send"
          disabled={isLoading}
          onClick={handleSend}
        >
          {isLoading ? (
            <>
              <span className="btn-spinner"></span>
              <span>Processing & Generating Code...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} className="btn-sparkle" />
              <span>
                Generate 6-Digit Code &amp; QR
                {attachments.length > 0 ? ` (${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''}
              </span>
              <span className="kbd-hint">Ctrl + Enter</span>
            </>
          )}
        </button>
      </div>

      {/* Lightbox Gallery Modal for Image Inspection with Next/Prev navigation */}
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
