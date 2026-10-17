import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

// Initialize PDF.js worker in browser environment
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

/**
 * Convert text to a cleanly paginated PDF Blob using pdf-lib
 */
export async function createPdfFromText(
  title: string,
  text: string
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28 // A4 standard width (pt)
  const pageHeight = 841.89 // A4 standard height (pt)
  const margin = 45
  const contentWidth = pageWidth - margin * 2
  const fontSize = 11
  const lineHeight = 16

  // Helper function to wrap text within width
  const wrapText = (str: string, width: number, f: typeof font, size: number) => {
    const words = str.split(/\s+/)
    const wrappedLines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = f.widthOfTextAtSize(testLine, size)
      if (testWidth > width && currentLine) {
        wrappedLines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine)
    }
    return wrappedLines
  }

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - margin

  // Draw title
  currentPage.drawText(title, {
    x: margin,
    y: cursorY - 14,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  cursorY -= 36

  // Split input into lines
  const rawLines = text.split('\n')
  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      cursorY -= lineHeight * 0.8
      continue
    }

    const isHeading = rawLine.startsWith('--- Page ') || rawLine.startsWith('# ')
    const useFont = isHeading ? fontBold : font
    const useSize = isHeading ? 12 : fontSize
    const cleanLine = rawLine.replace(/^#+\s*/, '')
    const wrapped = wrapText(cleanLine, contentWidth, useFont, useSize)

    for (const wLine of wrapped) {
      if (cursorY - lineHeight < margin) {
        // Need new page
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        cursorY = pageHeight - margin
      }

      currentPage.drawText(wLine, {
        x: margin,
        y: cursorY - useSize,
        size: useSize,
        font: useFont,
        color: isHeading ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
      })
      cursorY -= lineHeight
    }
  }

  const pdfBytes = await pdfDoc.save()
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/pdf' })
}

/**
 * Convert an array of images to a multi-page PDF using pdf-lib
 */
export async function createPdfFromImages(
  images: { file: File; dataUrl: string; name: string }[],
  options: {
    pageSize: 'a4' | 'fit' | 'letter'
    margin: number
  } = { pageSize: 'a4', margin: 20 }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()

  for (const imgItem of images) {
    const arrayBuffer = await imgItem.file.arrayBuffer()
    let embeddedImage: any

    const isPng = imgItem.file.type.includes('png') || imgItem.name.toLowerCase().endsWith('.png')
    if (isPng) {
      try {
        embeddedImage = await pdfDoc.embedPng(arrayBuffer)
      } catch {
        // Fallback to jpg if png decode fails
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer)
      }
    } else {
      try {
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer)
      } catch {
        embeddedImage = await pdfDoc.embedPng(arrayBuffer)
      }
    }

    const { width: imgWidth, height: imgHeight } = embeddedImage.scale(1)

    if (options.pageSize === 'fit') {
      const page = pdfDoc.addPage([imgWidth, imgHeight])
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
      })
    } else {
      // Standard A4: 595.28 x 841.89
      const pageWidth = options.pageSize === 'letter' ? 612 : 595.28
      const pageHeight = options.pageSize === 'letter' ? 792 : 841.89
      const margin = options.margin

      const availableWidth = pageWidth - margin * 2
      const availableHeight = pageHeight - margin * 2

      // Scale to fit available dimensions preserving aspect ratio
      const widthRatio = availableWidth / imgWidth
      const heightRatio = availableHeight / imgHeight
      const scale = Math.min(widthRatio, heightRatio, 1)

      const finalWidth = imgWidth * scale
      const finalHeight = imgHeight * scale

      const posX = margin + (availableWidth - finalWidth) / 2
      const posY = margin + (availableHeight - finalHeight) / 2

      const page = pdfDoc.addPage([pageWidth, pageHeight])
      page.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: finalWidth,
        height: finalHeight,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/pdf' })
}

/**
 * Merge multiple PDF files into one PDF
 */
export async function mergePdfFiles(files: File[]): Promise<Blob> {
  const mergedPdf = await PDFDocument.create()

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await PDFDocument.load(arrayBuffer)
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    copiedPages.forEach((page) => mergedPdf.addPage(page))
  }

  const pdfBytes = await mergedPdf.save()
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/pdf' })
}

/**
 * Split a PDF file by extracting selected page ranges (e.g. "1, 3-5, 8")
 */
export async function splitPdf(file: File, pageRangesStr: string): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const srcDoc = await PDFDocument.load(arrayBuffer)
  const totalPages = srcDoc.getPageCount()

  // Parse page range string (1-indexed)
  const targetIndices: number[] = []
  const parts = pageRangesStr.split(',').map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
        throw new Error(`Invalid page range "${part}". Valid range is 1 to ${totalPages}.`)
      }
      for (let i = start; i <= end; i++) {
        targetIndices.push(i - 1)
      }
    } else {
      const pageNum = parseInt(part, 10)
      if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        throw new Error(`Invalid page number "${part}". Document has ${totalPages} page(s).`)
      }
      targetIndices.push(pageNum - 1)
    }
  }

  if (targetIndices.length === 0) {
    throw new Error('No valid pages selected for extraction.')
  }

  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, targetIndices)
  copiedPages.forEach((page) => newDoc.addPage(page))

  const pdfBytes = await newDoc.save()
  const outBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  return new Blob([outBuffer], { type: 'application/pdf' })
}

/**
 * Rotate PDF pages by 90, 180, or 270 degrees
 */
export async function rotatePdfPages(
  file: File,
  rotationDegrees: number,
  pageNumbers?: number[]
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const pages = pdfDoc.getPages()

  const targetSet = pageNumbers && pageNumbers.length > 0 ? new Set(pageNumbers.map((p) => p - 1)) : null

  pages.forEach((page, idx) => {
    if (!targetSet || targetSet.has(idx)) {
      const currentRotation = page.getRotation().angle
      const nextRotation = (currentRotation + rotationDegrees) % 360
      page.setRotation(degrees(nextRotation))
    }
  })

  const pdfBytes = await pdfDoc.save()
  const outBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  return new Blob([outBuffer], { type: 'application/pdf' })
}

/**
 * Render PDF pages to high-res PNG data URLs in browser using PDF.js
 */
export async function renderPdfPagesToImages(
  file: File,
  maxPages = 30,
  scale = 1.5
): Promise<{ pageNum: number; dataUrl: string; width: number; height: number }[]> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  const numPages = Math.min(pdf.numPages, maxPages)
  const results: { pageNum: number; dataUrl: string; width: number; height: number }[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    canvas.width = viewport.width
    canvas.height = viewport.height

    const renderContext = {
      canvasContext: ctx,
      viewport,
      canvas,
    }

    await page.render(renderContext).promise
    const dataUrl = canvas.toDataURL('image/png')
    results.push({
      pageNum,
      dataUrl,
      width: viewport.width,
      height: viewport.height,
    })
  }

  return results
}

/**
 * Extract clean formatted text and HTML from a Word (.docx) document using mammoth
 */
export async function extractDocxContent(
  file: File
): Promise<{ text: string; html: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const textResult = await mammoth.extractRawText({ arrayBuffer })
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer })

  return {
    text: textResult.value.trim(),
    html: htmlResult.value,
  }
}
