import React, { useState, useRef } from 'react'
import {
  X,
  Check,
  Send,
  Download,
  Image as ImageIcon,
  Files,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertCircle,
  Loader2,
  FileCheck,
  Plus,
} from 'lucide-react'
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound'
import {
  createPdfFromText,
  createPdfFromImages,
  mergePdfFiles,
} from '../utils/docConverter'

interface DocToolsModalProps {
  isOpen: boolean
  onClose: () => void
  onSendTextToClipboard: (text: string) => void
  onSendFileToClipboard?: (file: File) => void
}

type ToolTab = 'img-to-pdf' | 'merge-pdf' | 'text-to-pdf'

interface ImageFileItem {
  id: string
  file: File
  dataUrl: string
  name: string
  size: number
}

interface MergePdfItem {
  id: string
  file: File
  name: string
  size: number
}

export const DocToolsModal: React.FC<DocToolsModalProps> = ({
  isOpen,
  onClose,
  onSendTextToClipboard: _onSendTextToClipboard,
  onSendFileToClipboard,
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('img-to-pdf')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // 1. Image to PDF State
  const [imagesList, setImagesList] = useState<ImageFileItem[]>([])
  const [imgPageSize, setImgPageSize] = useState<'a4' | 'fit' | 'letter'>('a4')
  const [imgMargin, setImgMargin] = useState<number>(20)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 2. Merge PDF State
  const [mergePdfList, setMergePdfList] = useState<MergePdfItem[]>([])
  const mergeInputRef = useRef<HTMLInputElement>(null)

  // 3. Text to PDF State
  const [textDocTitle, setTextDocTitle] = useState('Document_Export')
  const [textDocBody, setTextDocBody] = useState('')

  if (!isOpen) return null

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setErrorMsg(null)
    playSuccessSound()
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const showError = (msg: string) => {
    setErrorMsg(msg)
    setSuccessMsg(null)
    playErrorSound()
  }

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const sendFileToClipSync = (file: File) => {
    if (onSendFileToClipboard) {
      onSendFileToClipboard(file)
    } else {
      window.dispatchEvent(new CustomEvent('clipsync:attach-file', { detail: file }))
    }
    showSuccess(`"${file.name}" sent to ClipSync! You can now create a PIN to share it.`)
    setTimeout(() => onClose(), 1200)
  }

  // ----------------------------------------------------
  // TOOL 3: Image to PDF Handlers
  // ----------------------------------------------------
  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsLoading(true)
    setErrorMsg(null)
    playClickSound()

    const newItems: ImageFileItem[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f.type.startsWith('image/')) continue

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(f)
      })

      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        file: f,
        dataUrl,
        name: f.name,
        size: f.size,
      })
    }

    setImagesList((prev) => [...prev, ...newItems])
    setIsLoading(false)
    showSuccess(`Added ${newItems.length} image(s)!`)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const moveImage = (index: number, direction: 'up' | 'down') => {
    playClickSound()
    setImagesList((prev) => {
      const next = [...prev]
      const targetIdx = direction === 'up' ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
  }

  const removeImage = (id: string) => {
    playClickSound()
    setImagesList((prev) => prev.filter((img) => img.id !== id))
  }

  const handleGeneratePdfFromImages = async (shouldSendToClip = false) => {
    if (imagesList.length === 0) {
      showError('Please add at least one image.')
      return
    }

    setIsLoading(true)
    playClickSound()

    try {
      const pdfBlob = await createPdfFromImages(imagesList, {
        pageSize: imgPageSize,
        margin: imgMargin,
      })
      const filename = `Images_${Date.now()}.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([pdfBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(pdfBlob, filename)
        showSuccess(`Generated and downloaded ${filename} with ${imagesList.length} page(s)!`)
      }
    } catch (err: any) {
      showError('Failed to generate PDF from images: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 4: Merge PDF Handlers
  // ----------------------------------------------------
  const handleMergePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    playClickSound()
    const newItems: MergePdfItem[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          file: f,
          name: f.name,
          size: f.size,
        })
      }
    }

    setMergePdfList((prev) => [...prev, ...newItems])
    showSuccess(`Added ${newItems.length} PDF file(s) for merging.`)
    if (mergeInputRef.current) mergeInputRef.current.value = ''
  }

  const moveMergePdf = (index: number, direction: 'up' | 'down') => {
    playClickSound()
    setMergePdfList((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      return next
    })
  }

  const removeMergePdf = (id: string) => {
    playClickSound()
    setMergePdfList((prev) => prev.filter((item) => item.id !== id))
  }

  const handleMergePdf = async (shouldSendToClip = false) => {
    if (mergePdfList.length < 2) {
      showError('Please add at least 2 PDF files to merge.')
      return
    }

    setIsLoading(true)
    playClickSound()

    try {
      const files = mergePdfList.map((item) => item.file)
      const mergedBlob = await mergePdfFiles(files)
      const filename = `Merged_${Date.now()}.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([mergedBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(mergedBlob, filename)
        showSuccess(`Merged ${mergePdfList.length} PDFs into ${filename}!`)
      }
    } catch (err: any) {
      showError('Merge failed: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 5: Text to PDF Handlers
  // ----------------------------------------------------
  const handleConvertTextToPdf = async (shouldSendToClip = false) => {
    if (!textDocBody.trim()) {
      showError('Please enter some text or notes.')
      return
    }

    setIsLoading(true)
    playClickSound()

    try {
      const title = textDocTitle.trim() || 'Notes'
      const pdfBlob = await createPdfFromText(title, textDocBody)
      const filename = `${title.replace(/\s+/g, '_')}.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([pdfBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(pdfBlob, filename)
        showSuccess(`Created PDF: ${filename}`)
      }
    } catch (err: any) {
      showError('Failed to convert text to PDF: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card doctools-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header doctools-header">
          <div className="modal-title-group">
            <span className="doctools-badge">
              <FileCheck size={14} /> PDF &amp; Document Suite
            </span>
            <h2>Document Tools &amp; Converters</h2>
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

        {/* Navigation Tabs */}
        <div className="doctools-tabs">
          <button
            type="button"
            className={`doc-tab ${activeTab === 'img-to-pdf' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('img-to-pdf')
              setErrorMsg(null)
            }}
          >
            <ImageIcon size={15} />
            <span>Image to PDF</span>
          </button>

          <button
            type="button"
            className={`doc-tab ${activeTab === 'merge-pdf' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('merge-pdf')
              setErrorMsg(null)
            }}
          >
            <Files size={15} />
            <span>Merge PDF</span>
          </button>

          <button
            type="button"
            className={`doc-tab ${activeTab === 'text-to-pdf' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('text-to-pdf')
              setErrorMsg(null)
            }}
          >
            <Sparkles size={15} />
            <span>Text to PDF</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="doctools-alert error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="doctools-alert success">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="doctools-body">

          {/* ========================================================
              TAB 3: Image to PDF
              ======================================================== */}
          {activeTab === 'img-to-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Convert Photos &amp; Images to PDF</h3>
                <p>
                  Upload multiple photos (JPG, PNG, WEBP), arrange page order, choose margins and page size, and create a single multi-page PDF.
                </p>
              </div>

              {/* Add Images Dropzone */}
              <div
                className="doc-dropzone"
                onClick={() => imageInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  style={{ display: 'none' }}
                  onChange={handleImagesUpload}
                />
                <div className="dropzone-icon-wrap">
                  <ImageIcon size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to select photos or drag &amp; drop</span>
                  <span className="dropzone-sub">
                    {imagesList.length > 0
                      ? `${imagesList.length} image(s) selected`
                      : 'Supports PNG, JPG, JPEG, WEBP (Combine multiple pages)'}
                  </span>
                </div>
              </div>

              {/* Settings Row */}
              <div className="tool-settings-row">
                <div className="setting-item">
                  <label className="field-label">Page Size</label>
                  <select
                    className="styled-select"
                    value={imgPageSize}
                    onChange={(e) => setImgPageSize(e.target.value as any)}
                  >
                    <option value="a4">Standard A4</option>
                    <option value="letter">US Letter</option>
                    <option value="fit">Fit to Image Size</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="field-label">Page Margins</label>
                  <select
                    className="styled-select"
                    value={imgMargin}
                    onChange={(e) => setImgMargin(Number(e.target.value))}
                  >
                    <option value={0}>None (Full Bleed)</option>
                    <option value={15}>Compact (15pt)</option>
                    <option value={30}>Standard (30pt)</option>
                  </select>
                </div>
              </div>

              {/* Image Reordering List */}
              {imagesList.length > 0 && (
                <div className="image-items-list">
                  <span className="section-label">
                    Pages to Include ({imagesList.length} pages)
                  </span>

                  <div className="image-grid-preview">
                    {imagesList.map((img, idx) => (
                      <div key={img.id} className="image-preview-card">
                        <div className="img-thumbnail-wrap">
                          <img src={img.dataUrl} alt={img.name} />
                          <span className="img-page-num">Page {idx + 1}</span>
                        </div>
                        <div className="img-details">
                          <span className="img-name" title={img.name}>
                            {img.name}
                          </span>
                          <span className="img-size">{(img.size / 1024).toFixed(0)} KB</span>
                        </div>
                        <div className="img-card-actions">
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => moveImage(idx, 'up')}
                            disabled={idx === 0}
                            title="Move Page Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => moveImage(idx, 'down')}
                            disabled={idx === imagesList.length - 1}
                            title="Move Page Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-tiny danger"
                            onClick={() => removeImage(img.id)}
                            title="Remove Image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="tool-actions-bar">
                    <button
                      type="button"
                      className="btn-tool-action primary-yellow"
                      onClick={() => handleGeneratePdfFromImages(false)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      <span>Generate &amp; Download PDF ({imagesList.length} Pages)</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tool-action"
                      onClick={() => handleGeneratePdfFromImages(true)}
                      disabled={isLoading}
                    >
                      <Send size={16} />
                      <span>Send PDF to ClipSync</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 4: Merge PDF
              ======================================================== */}
          {activeTab === 'merge-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Combine Multiple PDFs into One</h3>
                <p>
                  Upload two or more PDF files, arrange their order, and merge all pages into a single organized PDF document.
                </p>
              </div>

              {/* Upload Drop Zone */}
              <div
                className="doc-dropzone"
                onClick={() => mergeInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={mergeInputRef}
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleMergePdfUpload}
                />
                <div className="dropzone-icon-wrap">
                  <Files size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to add PDF files to merge</span>
                  <span className="dropzone-sub">
                    {mergePdfList.length > 0
                      ? `${mergePdfList.length} PDF(s) added so far`
                      : 'Select multiple .pdf files'}
                  </span>
                </div>
              </div>

              {/* PDF list to merge */}
              {mergePdfList.length > 0 && (
                <div className="merge-list-container">
                  <div className="extracted-header">
                    <span className="section-label">Merge Order ({mergePdfList.length} files)</span>
                    <button
                      type="button"
                      className="btn-tiny"
                      onClick={() => mergeInputRef.current?.click()}
                    >
                      <Plus size={14} /> Add more PDFs
                    </button>
                  </div>

                  <div className="merge-items-rows">
                    {mergePdfList.map((item, idx) => (
                      <div key={item.id} className="merge-item-row">
                        <span className="merge-num-badge">{idx + 1}</span>
                        <div className="merge-item-info">
                          <span className="merge-file-name">{item.name}</span>
                          <span className="merge-file-size">
                            {(item.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="merge-item-actions">
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => moveMergePdf(idx, 'up')}
                            disabled={idx === 0}
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => moveMergePdf(idx, 'down')}
                            disabled={idx === mergePdfList.length - 1}
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-tiny danger"
                            onClick={() => removeMergePdf(item.id)}
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="tool-actions-bar">
                    <button
                      type="button"
                      className="btn-tool-action primary-yellow"
                      onClick={() => handleMergePdf(false)}
                      disabled={isLoading || mergePdfList.length < 2}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      <span>Merge &amp; Download Combined PDF</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tool-action"
                      onClick={() => handleMergePdf(true)}
                      disabled={isLoading || mergePdfList.length < 2}
                    >
                      <Send size={16} />
                      <span>Send Merged PDF to ClipSync</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 5: Text to PDF
              ======================================================== */}
          {activeTab === 'text-to-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Quick Notes &amp; Text to PDF</h3>
                <p>
                  Type, dictate, or paste any notes, snippets, or reports to create a clean, crisp, paginated PDF instantly.
                </p>
              </div>

              <div className="input-field-group">
                <label className="field-label">Document Title</label>
                <input
                  type="text"
                  className="styled-text-input"
                  value={textDocTitle}
                  onChange={(e) => setTextDocTitle(e.target.value)}
                  placeholder="Document Title"
                />
              </div>

              <div className="input-field-group">
                <label className="field-label">Text Content</label>
                <textarea
                  className="styled-textarea doc-preview-textarea"
                  rows={8}
                  value={textDocBody}
                  onChange={(e) => setTextDocBody(e.target.value)}
                  placeholder="Type or paste your text, notes, code, or article here..."
                />
              </div>

              <div className="tool-actions-bar">
                <button
                  type="button"
                  className="btn-tool-action primary-yellow"
                  onClick={() => handleConvertTextToPdf(false)}
                  disabled={isLoading || !textDocBody.trim()}
                >
                  {isLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  <span>Generate &amp; Download PDF</span>
                </button>

                <button
                  type="button"
                  className="btn-tool-action"
                  onClick={() => handleConvertTextToPdf(true)}
                  disabled={isLoading || !textDocBody.trim()}
                >
                  <Send size={16} />
                  <span>Send PDF to ClipSync</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
