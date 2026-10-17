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
  Scissors,
  RotateCw,
  Layers,
  FileText,
  Copy,
} from 'lucide-react'
import { playClickSound, playSuccessSound, playErrorSound, playCopySound } from '../utils/sound'
import {
  createPdfFromText,
  createPdfFromImages,
  mergePdfFiles,
  splitPdf,
  rotatePdfPages,
  renderPdfPagesToImages,
  extractDocxContent,
} from '../utils/docConverter'
import { PDFDocument } from 'pdf-lib'

interface DocToolsModalProps {
  isOpen: boolean
  onClose: () => void
  onSendTextToClipboard: (text: string) => void
  onSendFileToClipboard?: (file: File) => void
}

type ToolTab =
  | 'img-to-pdf'
  | 'merge-pdf'
  | 'split-pdf'
  | 'rotate-pdf'
  | 'pdf-to-img'
  | 'docx-converter'
  | 'text-to-pdf'

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
  onSendTextToClipboard,
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

  // 3. Split PDF State
  const [splitFile, setSplitFile] = useState<File | null>(null)
  const [splitTotalPages, setSplitTotalPages] = useState<number>(0)
  const [splitPageRange, setSplitPageRange] = useState<string>('1-2')
  const splitInputRef = useRef<HTMLInputElement>(null)

  // 4. Rotate PDF State
  const [rotateFile, setRotateFile] = useState<File | null>(null)
  const [rotateTotalPages, setRotateTotalPages] = useState<number>(0)
  const [rotateDegrees, setRotateDegrees] = useState<number>(90)
  const [rotateTargetPages, setRotateTargetPages] = useState<string>('')
  const rotateInputRef = useRef<HTMLInputElement>(null)

  // 5. PDF to Images State
  const [pdfToImgFile, setPdfToImgFile] = useState<File | null>(null)
  const [renderedPages, setRenderedPages] = useState<
    { pageNum: number; dataUrl: string; width: number; height: number }[]
  >([])
  const pdfToImgInputRef = useRef<HTMLInputElement>(null)

  // 6. Word (.docx) Converter State
  const [docxFile, setDocxFile] = useState<File | null>(null)
  const [docxExtractedText, setDocxExtractedText] = useState<string>('')
  const docxInputRef = useRef<HTMLInputElement>(null)

  // 7. Text to PDF State
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
  // TOOL 1: Image to PDF Handlers
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
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
    } catch (err: unknown) {
      showError('Failed to generate PDF from images: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 2: Merge PDF Handlers
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
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
    } catch (err: unknown) {
      showError('Merge failed: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 3: Split PDF Handlers
  // ----------------------------------------------------
  const handleSplitPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    playClickSound()
    setIsLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      const count = pdf.getPageCount()
      setSplitFile(file)
      setSplitTotalPages(count)
      setSplitPageRange(count > 1 ? `1-${Math.min(2, count)}` : '1')
      showSuccess(`Loaded "${file.name}" (${count} pages). Enter page range to extract.`)
    } catch (err: unknown) {
      showError('Could not load PDF: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
      if (splitInputRef.current) splitInputRef.current.value = ''
    }
  }

  const handleExecuteSplit = async (shouldSendToClip = false) => {
    if (!splitFile) {
      showError('Please select a PDF file first.')
      return
    }
    if (!splitPageRange.trim()) {
      showError('Please enter page ranges to extract (e.g. "1, 3-5").')
      return
    }

    setIsLoading(true)
    playClickSound()
    try {
      const splitBlob = await splitPdf(splitFile, splitPageRange)
      const baseName = splitFile.name.replace(/\.pdf$/i, '')
      const filename = `${baseName}_extracted.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([splitBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(splitBlob, filename)
        showSuccess(`Extracted pages successfully into ${filename}!`)
      }
    } catch (err: unknown) {
      showError('Split error: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 4: Rotate PDF Handlers
  // ----------------------------------------------------
  const handleRotatePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    playClickSound()
    setIsLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      const count = pdf.getPageCount()
      setRotateFile(file)
      setRotateTotalPages(count)
      setRotateTargetPages('')
      showSuccess(`Loaded "${file.name}" (${count} pages). Choose rotation angle.`)
    } catch (err: unknown) {
      showError('Could not load PDF: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
      if (rotateInputRef.current) rotateInputRef.current.value = ''
    }
  }

  const handleExecuteRotate = async (shouldSendToClip = false) => {
    if (!rotateFile) {
      showError('Please select a PDF file first.')
      return
    }

    setIsLoading(true)
    playClickSound()
    try {
      let pageNums: number[] | undefined
      if (rotateTargetPages.trim()) {
        pageNums = rotateTargetPages
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= rotateTotalPages)
      }

      const rotatedBlob = await rotatePdfPages(rotateFile, rotateDegrees, pageNums)
      const baseName = rotateFile.name.replace(/\.pdf$/i, '')
      const filename = `${baseName}_rotated_${rotateDegrees}deg.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([rotatedBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(rotatedBlob, filename)
        showSuccess(`Rotated pages by ${rotateDegrees}° and downloaded ${filename}!`)
      }
    } catch (err: unknown) {
      showError('Rotation error: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 5: PDF to Images Handlers
  // ----------------------------------------------------
  const handlePdfToImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    playClickSound()
    setIsLoading(true)
    setErrorMsg(null)
    setPdfToImgFile(file)
    setRenderedPages([])

    try {
      const pages = await renderPdfPagesToImages(file, 25, 1.5)
      setRenderedPages(pages)
      showSuccess(`Rendered ${pages.length} page(s) into high-resolution images!`)
    } catch (err: unknown) {
      showError('Failed to extract images from PDF: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
      if (pdfToImgInputRef.current) pdfToImgInputRef.current.value = ''
    }
  }

  const handleDownloadSingleImage = (dataUrl: string, pageNum: number) => {
    playClickSound()
    const baseName = pdfToImgFile?.name.replace(/\.pdf$/i, '') || 'page'
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${baseName}_page_${pageNum}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showSuccess(`Downloaded Page ${pageNum} PNG!`)
  }

  const handleSendImageToClip = async (dataUrl: string, pageNum: number) => {
    playClickSound()
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const baseName = pdfToImgFile?.name.replace(/\.pdf$/i, '') || 'page'
    const file = new File([blob], `${baseName}_page_${pageNum}.png`, { type: 'image/png' })
    sendFileToClipSync(file)
  }

  // ----------------------------------------------------
  // TOOL 6: Word (.docx) Converter Handlers
  // ----------------------------------------------------
  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    playClickSound()
    setIsLoading(true)
    setErrorMsg(null)
    setDocxFile(file)

    try {
      const { text } = await extractDocxContent(file)
      setDocxExtractedText(text)
      showSuccess(`Extracted text from "${file.name}"! (${text.length} characters)`)
    } catch (err: unknown) {
      showError('Failed to parse Word document: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
      if (docxInputRef.current) docxInputRef.current.value = ''
    }
  }

  const handleSendDocxToEditor = () => {
    if (!docxExtractedText) return
    onSendTextToClipboard(docxExtractedText)
    playCopySound()
    showSuccess('Sent Word document text to clip editor!')
    setTimeout(() => onClose(), 1000)
  }

  const handleConvertDocxToPdf = async (shouldSendToClip = false) => {
    if (!docxExtractedText) return
    setIsLoading(true)
    try {
      const title = docxFile?.name.replace(/\.docx$/i, '') || 'Document'
      const pdfBlob = await createPdfFromText(title, docxExtractedText)
      const filename = `${title}.pdf`

      if (shouldSendToClip) {
        const fileObj = new File([pdfBlob], filename, { type: 'application/pdf' })
        sendFileToClipSync(fileObj)
      } else {
        triggerDownload(pdfBlob, filename)
        showSuccess(`Converted "${docxFile?.name}" into ${filename}!`)
      }
    } catch (err: unknown) {
      showError('Failed to convert to PDF: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // TOOL 7: Text to PDF Handlers
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
    } catch (err: unknown) {
      showError('Failed to convert text to PDF: ' + (err as Error).message)
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
              <FileCheck size={14} /> PDF &amp; Document Powerhouse
            </span>
            <h2>In-Browser Document &amp; PDF Studio</h2>
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
            className={`doc-tab ${activeTab === 'split-pdf' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('split-pdf')
              setErrorMsg(null)
            }}
          >
            <Scissors size={15} />
            <span>Split &amp; Extract</span>
          </button>

          <button
            type="button"
            className={`doc-tab ${activeTab === 'rotate-pdf' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('rotate-pdf')
              setErrorMsg(null)
            }}
          >
            <RotateCw size={15} />
            <span>Rotate Pages</span>
          </button>

          <button
            type="button"
            className={`doc-tab ${activeTab === 'pdf-to-img' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('pdf-to-img')
              setErrorMsg(null)
            }}
          >
            <Layers size={15} />
            <span>PDF to Images</span>
          </button>

          <button
            type="button"
            className={`doc-tab ${activeTab === 'docx-converter' ? 'active' : ''}`}
            onClick={() => {
              playClickSound()
              setActiveTab('docx-converter')
              setErrorMsg(null)
            }}
          >
            <FileText size={15} />
            <span>Word (.docx)</span>
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

          {/* TAB 1: Image to PDF */}
          {activeTab === 'img-to-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Convert Photos &amp; Images to PDF</h3>
                <p>
                  Upload multiple photos (JPG, PNG, WEBP), arrange page order, choose margins and page size, and create a single multi-page PDF.
                </p>
              </div>

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

              <div className="tool-settings-row">
                <div className="setting-item">
                  <label className="field-label">Page Size</label>
                  <select
                    className="styled-select"
                    value={imgPageSize}
                    onChange={(e) => setImgPageSize(e.target.value as 'a4' | 'fit' | 'letter')}
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

          {/* TAB 2: Merge PDF */}
          {activeTab === 'merge-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Combine Multiple PDFs into One</h3>
                <p>
                  Upload two or more PDF files, arrange their order, and merge all pages into a single organized PDF document.
                </p>
              </div>

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

          {/* TAB 3: Split & Extract */}
          {activeTab === 'split-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Split &amp; Extract PDF Pages</h3>
                <p>
                  Extract individual pages or custom ranges (e.g. 1-3, 5, 8) into a fresh, lightweight PDF with zero server upload.
                </p>
              </div>

              <div
                className="doc-dropzone"
                onClick={() => splitInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={splitInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleSplitPdfUpload}
                />
                <div className="dropzone-icon-wrap">
                  <Scissors size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to select PDF to split</span>
                  <span className="dropzone-sub">
                    {splitFile
                      ? `Selected: "${splitFile.name}" (${splitTotalPages} pages)`
                      : 'Choose a single PDF to extract pages from'}
                  </span>
                </div>
              </div>

              {splitFile && (
                <div className="split-config-box">
                  <div className="input-field-group">
                    <label className="field-label">
                      Page Ranges to Extract (Document has {splitTotalPages} pages)
                    </label>
                    <input
                      type="text"
                      className="styled-text-input"
                      value={splitPageRange}
                      onChange={(e) => setSplitPageRange(e.target.value)}
                      placeholder="e.g. 1-2, 4, 7-9"
                    />
                    <span className="input-hint">
                      Separate pages with commas or ranges with hyphens. Example: <code>1-3, 5</code>
                    </span>
                  </div>

                  <div className="tool-actions-bar">
                    <button
                      type="button"
                      className="btn-tool-action primary-yellow"
                      onClick={() => handleExecuteSplit(false)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      <span>Extract &amp; Download PDF</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tool-action"
                      onClick={() => handleExecuteSplit(true)}
                      disabled={isLoading}
                    >
                      <Send size={16} />
                      <span>Send to ClipSync</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Rotate Pages */}
          {activeTab === 'rotate-pdf' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Rotate PDF Pages</h3>
                <p>
                  Permanently rotate sideways or upside-down pages by 90°, 180°, or 270° clockwise.
                </p>
              </div>

              <div
                className="doc-dropzone"
                onClick={() => rotateInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={rotateInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleRotatePdfUpload}
                />
                <div className="dropzone-icon-wrap">
                  <RotateCw size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to select PDF to rotate</span>
                  <span className="dropzone-sub">
                    {rotateFile
                      ? `Selected: "${rotateFile.name}" (${rotateTotalPages} pages)`
                      : 'Choose a PDF to fix orientation'}
                  </span>
                </div>
              </div>

              {rotateFile && (
                <div className="rotate-config-box">
                  <div className="tool-settings-row">
                    <div className="setting-item">
                      <label className="field-label">Rotation Angle</label>
                      <select
                        className="styled-select"
                        value={rotateDegrees}
                        onChange={(e) => setRotateDegrees(Number(e.target.value))}
                      >
                        <option value={90}>90° Clockwise</option>
                        <option value={180}>180° Half Turn</option>
                        <option value={270}>270° (90° Counter-Clockwise)</option>
                      </select>
                    </div>

                    <div className="setting-item">
                      <label className="field-label">Target Pages (Leave empty for all pages)</label>
                      <input
                        type="text"
                        className="styled-text-input"
                        value={rotateTargetPages}
                        onChange={(e) => setRotateTargetPages(e.target.value)}
                        placeholder="e.g. 1, 3 (Optional)"
                      />
                    </div>
                  </div>

                  <div className="tool-actions-bar">
                    <button
                      type="button"
                      className="btn-tool-action primary-yellow"
                      onClick={() => handleExecuteRotate(false)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" /> : <RotateCw size={16} />}
                      <span>Rotate &amp; Download PDF</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tool-action"
                      onClick={() => handleExecuteRotate(true)}
                      disabled={isLoading}
                    >
                      <Send size={16} />
                      <span>Send to ClipSync</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PDF to Images */}
          {activeTab === 'pdf-to-img' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Extract High-Res Images from PDF</h3>
                <p>
                  Render any PDF's pages directly into crystal-clear PNG images on your device with hardware-accelerated canvas.
                </p>
              </div>

              <div
                className="doc-dropzone"
                onClick={() => pdfToImgInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={pdfToImgInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handlePdfToImgUpload}
                />
                <div className="dropzone-icon-wrap">
                  <Layers size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to select PDF to render pages</span>
                  <span className="dropzone-sub">
                    {pdfToImgFile
                      ? `Selected: "${pdfToImgFile.name}"`
                      : 'Extract pages as PNG image files'}
                  </span>
                </div>
              </div>

              {renderedPages.length > 0 && (
                <div className="pdf-images-preview-grid">
                  <span className="section-label">
                    Rendered Pages ({renderedPages.length} pages)
                  </span>

                  <div className="image-grid-preview">
                    {renderedPages.map((page) => (
                      <div key={page.pageNum} className="image-preview-card">
                        <div className="img-thumbnail-wrap">
                          <img src={page.dataUrl} alt={`Page ${page.pageNum}`} />
                          <span className="img-page-num">Page {page.pageNum}</span>
                        </div>
                        <div className="img-card-actions" style={{ justifyContent: 'space-between', padding: '0.4rem 0.6rem' }}>
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => handleDownloadSingleImage(page.dataUrl, page.pageNum)}
                            title="Download PNG"
                          >
                            <Download size={13} /> Save PNG
                          </button>
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => handleSendImageToClip(page.dataUrl, page.pageNum)}
                            title="Send to Clip"
                          >
                            <Send size={13} /> Clip
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Word (.docx) Converter */}
          {activeTab === 'docx-converter' && (
            <div className="tool-panel">
              <div className="tool-intro">
                <h3>Word (.docx) to Clean Text &amp; PDF</h3>
                <p>
                  Extract formatted text, paragraphs, and tables from any Microsoft Word document directly in browser.
                </p>
              </div>

              <div
                className="doc-dropzone"
                onClick={() => docxInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={docxInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={handleDocxUpload}
                />
                <div className="dropzone-icon-wrap">
                  <FileText size={28} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-title">Click to select Word document (.docx)</span>
                  <span className="dropzone-sub">
                    {docxFile
                      ? `Selected: "${docxFile.name}"`
                      : 'Extract text or convert Word documents to PDF'}
                  </span>
                </div>
              </div>

              {docxExtractedText && (
                <div className="docx-result-container">
                  <div className="extracted-header">
                    <span className="section-label">Extracted Content Preview</span>
                    <button
                      type="button"
                      className="btn-tiny"
                      onClick={() => {
                        navigator.clipboard.writeText(docxExtractedText)
                        playCopySound()
                        showSuccess('Copied extracted text to clipboard!')
                      }}
                    >
                      <Copy size={13} /> Copy Text
                    </button>
                  </div>

                  <textarea
                    className="styled-textarea doc-preview-textarea"
                    rows={8}
                    readOnly
                    value={docxExtractedText}
                  />

                  <div className="tool-actions-bar">
                    <button
                      type="button"
                      className="btn-tool-action primary-yellow"
                      onClick={() => handleConvertDocxToPdf(false)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      <span>Convert &amp; Download as PDF</span>
                    </button>

                    <button
                      type="button"
                      className="btn-tool-action"
                      onClick={handleSendDocxToEditor}
                    >
                      <Send size={16} />
                      <span>Send to Clip Editor</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: Text to PDF */}
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
