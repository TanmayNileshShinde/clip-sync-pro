import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, X, AlertCircle, RefreshCw, FlipHorizontal } from 'lucide-react'
import { playSuccessSound, playErrorSound, playClickSound } from '../utils/sound'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onCodeScanned: (code: string) => void
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onCodeScanned,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [isScanning, setIsScanning] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }, [])

  const handleDetectedPayload = useCallback((raw: string) => {
    let extractedCode = ''

    // Check if raw is a URL with ?code=123456
    try {
      const url = new URL(raw)
      const c = url.searchParams.get('code')
      if (c && /^\d{6}$/.test(c)) {
        extractedCode = c
      }
    } catch {
      // Not a full URL, check if pure 6 digits or contains 6 digits
      const match = raw.match(/\b\d{6}\b/)
      if (match) {
        extractedCode = match[0]
      }
    }

    if (extractedCode) {
      playSuccessSound()
      stopCamera()
      onCodeScanned(extractedCode)
      onClose()
    }
  }, [stopCamera, onCodeScanned, onClose])

  const startCamera = useCallback(async () => {
    stopCamera()
    setErrorMsg(null)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by your browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsScanning(true)

      // Check if native BarcodeDetector API is supported
      const hasBarcodeDetector = 'BarcodeDetector' in window
      let barcodeDetector: any = null
      if (hasBarcodeDetector) {
        try {
          barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        } catch {
          barcodeDetector = null
        }
      }

      // Scanner poll loop
      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return

        try {
          if (barcodeDetector) {
            const barcodes = await barcodeDetector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue || ''
              handleDetectedPayload(rawValue)
            }
          }
        } catch {
          // Scanner frame error ignored
        }
      }, 250)
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Unable to access camera. Please check permissions.')
      playErrorSound()
      setIsScanning(false)
    }
  }, [facingMode, stopCamera, handleDetectedPayload])

  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(() => {
      void startCamera()
    }, 50)

    return () => {
      clearTimeout(timer)
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card qr-scanner-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92vw', padding: 0, overflow: 'hidden' }}
      >
        <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--card-border)' }}>
          <div className="modal-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={18} className="text-accent" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Scan QR Code</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => {
              playClickSound()
              onClose()
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="scanner-view-container" style={{ position: 'relative', background: '#000', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Scanner Overlay Frame */}
          <div
            className="scanner-target-box"
            style={{
              position: 'absolute',
              width: '210px',
              height: '210px',
              border: '2px solid var(--accent-primary)',
              borderRadius: '16px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="scanner-laser"
              style={{
                width: '100%',
                height: '2px',
                background: 'var(--accent-primary)',
                boxShadow: '0 0 8px var(--accent-primary)',
                animation: 'laserScan 2s infinite ease-in-out',
              }}
            />
          </div>

          {/* Camera controls */}
          <div style={{ position: 'absolute', bottom: '12px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-tiny"
              style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '20px' }}
              onClick={() => {
                playClickSound()
                setFacingMode((cur) => (cur === 'environment' ? 'user' : 'environment'))
              }}
            >
              <FlipHorizontal size={14} style={{ marginRight: '4px' }} /> Flip Camera
            </button>
            <button
              type="button"
              className="btn-tiny"
              style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '20px' }}
              onClick={startCamera}
            >
              <RefreshCw size={14} style={{ marginRight: '4px' }} /> Restart
            </button>
          </div>
        </div>

        {errorMsg ? (
          <div style={{ padding: '1rem', background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {isScanning
              ? '⚡ Scanning camera feed for ClipSync QR code...'
              : 'Point camera at the ClipSync QR code to auto-load your clip instantly.'}
          </div>
        )}
      </div>
    </div>
  )
}
