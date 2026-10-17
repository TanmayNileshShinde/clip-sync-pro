import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  createPdfFromText,
  mergePdfFiles,
  splitPdf,
  rotatePdfPages,
} from '../src/utils/docConverter'

describe('Document & PDF Manipulation Studio', () => {
  it('creates a valid PDF document blob from text notes', async () => {
    const title = 'Production Architecture Review'
    const body = 'This is a test note for ClipSync Pro document studio.\nMulti-line pagination support.'

    const blob = await createPdfFromText(title, body)
    expect(blob).toBeDefined()
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)

    const arrayBuffer = await blob.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('merges multiple PDF files into a single unified PDF', async () => {
    // Generate two small PDFs
    const pdfBlob1 = await createPdfFromText('Document 1', 'First page content')
    const pdfBlob2 = await createPdfFromText('Document 2', 'Second page content')

    const file1 = new File([pdfBlob1], 'doc1.pdf', { type: 'application/pdf' })
    const file2 = new File([pdfBlob2], 'doc2.pdf', { type: 'application/pdf' })

    const mergedBlob = await mergePdfFiles([file1, file2])
    expect(mergedBlob.type).toBe('application/pdf')

    const arrayBuffer = await mergedBlob.arrayBuffer()
    const mergedDoc = await PDFDocument.load(arrayBuffer)
    expect(mergedDoc.getPageCount()).toBe(2)
  })

  it('splits and extracts specific page ranges from a PDF', async () => {
    // Generate a 3-page PDF
    const baseBlob = await createPdfFromText('Long Document', 'Page 1\n\n' + 'line\n'.repeat(70))
    const arrayBuffer = await baseBlob.arrayBuffer()
    const baseDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = baseDoc.getPageCount()

    const file = new File([baseBlob], 'multipage.pdf', { type: 'application/pdf' })

    // Split page 1 only
    const splitBlob = await splitPdf(file, '1')
    const splitDoc = await PDFDocument.load(await splitBlob.arrayBuffer())
    expect(splitDoc.getPageCount()).toBe(1)

    // Test invalid page range throws expected error
    await expect(splitPdf(file, `${totalPages + 10}`)).rejects.toThrow('Invalid page number')
  })

  it('rotates PDF pages by 90 degrees correctly', async () => {
    const baseBlob = await createPdfFromText('Rotate Document', 'Content to rotate')
    const file = new File([baseBlob], 'rotate.pdf', { type: 'application/pdf' })

    const rotatedBlob = await rotatePdfPages(file, 90)
    const rotatedDoc = await PDFDocument.load(await rotatedBlob.arrayBuffer())
    const firstPage = rotatedDoc.getPage(0)
    expect(firstPage.getRotation().angle).toBe(90)
  })
})
