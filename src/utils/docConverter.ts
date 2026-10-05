import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as docx from 'docx'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker using unpkg or fallback to avoid worker bundling issues
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

/**
 * Extract plain text and metadata from a PDF file
 */
export async function extractTextFromPdf(file: File): Promise<{
  text: string
  pageCount: number
  info: string
}> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages
    let fullText = ''

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      
      fullText += `--- Page ${i} ---\n` + pageText.trim() + '\n\n'
    }

    return {
      text: fullText.trim(),
      pageCount: numPages,
      info: `Extracted ${numPages} page(s) successfully`
    }
  } catch (err: any) {
    // Fallback: simple text stream extraction from binary
    console.warn('PDF.js parse warning, attempting stream fallback:', err)
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let extracted = ''
    let textChunk = ''
    for (let i = 0; i < bytes.length; i++) {
      const ch = bytes[i]
      if (ch >= 32 && ch <= 126) {
        textChunk += String.fromCharCode(ch)
      } else if (ch === 10 || ch === 13) {
        if (textChunk.length > 3) extracted += textChunk + '\n'
        textChunk = ''
      }
    }
    return {
      text: extracted.slice(0, 50000) || 'Could not extract clean text from this PDF.',
      pageCount: 1,
      info: 'Extracted using fallback stream parser'
    }
  }
}

/**
 * Generate a Word .docx Blob from text
 */
export async function createDocxFromText(
  title: string,
  text: string
): Promise<Blob> {
  const paragraphs: docx.Paragraph[] = []

  // Add document title
  paragraphs.push(
    new docx.Paragraph({
      text: title,
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  )

  // Split text by lines/paragraphs
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('--- Page ')) {
      paragraphs.push(
        new docx.Paragraph({
          text: line,
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      )
    } else if (line.trim().length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          children: [new docx.TextRun(line)],
          spacing: { after: 100 },
        })
      )
    }
  }

  const doc = new docx.Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  })

  return await docx.Packer.toBlob(doc)
}

/**
 * Read text and HTML from a Word .docx file using mammoth
 */
export async function extractFromDocx(file: File): Promise<{
  text: string
  html: string
}> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const rawTextResult = await mammoth.extractRawText({ arrayBuffer })
  return {
    text: rawTextResult.value,
    html: result.value,
  }
}

/**
 * Convert text or extracted Word content to a cleanly paginated PDF Blob using pdf-lib
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
  const wrapText = (str: string, width: number, f: any, size: number) => {
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
