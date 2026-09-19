import React, { useEffect, useState } from 'react'
import { X, Download, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { playClickSound } from '../utils/sound'

export interface LightboxImage {
  content: string
  name: string
  size?: number
}

interface ImageLightboxModalProps {
  isOpen: boolean
  imageUrl?: string | null
  imageName?: string
  imageSize?: number
  images?: LightboxImage[]
  initialIndex?: number
  onClose: () => void
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  imageUrl,
  imageName = 'Image Preview',
  imageSize,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex)

  // Adjust state during render when initialIndex prop changes
  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex)
    setCurrentIndex(initialIndex)
  }

  // Determine active item
  const activeList: LightboxImage[] = images && images.length > 0
    ? images
    : imageUrl
    ? [{ content: imageUrl, name: imageName, size: imageSize }]
    : []

  const currentItem = activeList[currentIndex] || activeList[0]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' && activeList.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % activeList.length)
      } else if (e.key === 'ArrowLeft' && activeList.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + activeList.length) % activeList.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, activeList.length])

  if (!isOpen || !currentItem) return null

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    const link = document.createElement('a')
    link.href = currentItem.content
    link.download = currentItem.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    setCurrentIndex((prev) => (prev - 1 + activeList.length) % activeList.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    setCurrentIndex((prev) => (prev + 1) % activeList.length)
  }

  return (
    <div className="modal-backdrop lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="lightbox-header">
          <div className="lightbox-title-info">
            <span className="lightbox-filename">{currentItem.name}</span>
            {currentItem.size ? (
              <span className="lightbox-size">({(currentItem.size / 1024).toFixed(1)} KB)</span>
            ) : null}
            {activeList.length > 1 && (
              <span className="lightbox-counter-badge">
                {currentIndex + 1} / {activeList.length}
              </span>
            )}
          </div>

          <div className="lightbox-actions">
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleDownload}
              title="Download this image"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => {
                playClickSound()
                onClose()
              }}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* High-res Image View with Carousel Controls */}
        <div className="lightbox-body" onClick={onClose}>
          {activeList.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn prev"
              onClick={handlePrev}
              title="Previous photo (←)"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <img
            src={currentItem.content}
            alt={currentItem.name}
            className="lightbox-full-img"
            onClick={(e) => e.stopPropagation()}
          />

          {activeList.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn next"
              onClick={handleNext}
              title="Next photo (→)"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>

        {/* Footer Hint */}
        <div className="lightbox-footer">
          <ZoomIn size={14} />
          <span>
            {activeList.length > 1
              ? 'Use arrow keys (← / →) to navigate • Click outside or press Esc to close'
              : 'Click outside or press Esc to close'}
          </span>
        </div>
      </div>
    </div>
  )
}
