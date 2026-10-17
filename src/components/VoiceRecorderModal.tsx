import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, Play, Pause, Trash2, Check, X, AlertCircle } from 'lucide-react'
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound'

interface VoiceRecorderModalProps {
  isOpen: boolean
  onClose: () => void
  onVoiceRecorded: (file: File) => void
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onVoiceRecorded,
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Web Audio Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const cleanupStreams = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setIsRecording(false)
    setIsPlaying(false)
  }, [audioUrl])

  const startRecording = async () => {
    cleanupStreams()
    setErrorMsg(null)
    setAudioBlob(null)
    setRecordingDuration(0)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Setup Web Audio Analyser
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)

      // Start Visualizer Loop
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const drawWaveform = () => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        analyser.getByteFrequencyData(dataArray)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const barWidth = (canvas.width / bufferLength) * 2.2
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85
          // Gradient styling
          ctx.fillStyle = `hsl(${45 + (dataArray[i] / 255) * 60}, 95%, 55%)`
          ctx.beginPath()
          ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight + 4, 3)
          ctx.fill()
          x += barWidth
        }

        animationFrameRef.current = requestAnimationFrame(drawWaveform)
      }
      drawWaveform()

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(recordedBlob)
        const url = URL.createObjectURL(recordedBlob)
        setAudioUrl(url)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      playClickSound()

      // Duration counter
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((sec) => sec + 1)
      }, 1000)
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Microphone access denied')
      playErrorSound()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsRecording(false)
    playSuccessSound()
  }

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return
    if (isPlaying) {
      audioPlayerRef.current.pause()
      setIsPlaying(false)
    } else {
      audioPlayerRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleSaveAndAttach = () => {
    if (!audioBlob) return
    playClickSound()
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
    const fileName = `voice_note_${Date.now()}.${ext}`
    const file = new File([audioBlob], fileName, { type: audioBlob.type })
    onVoiceRecorded(file)
    onClose()
  }

  useEffect(() => {
    return () => {
      cleanupStreams()
    }
  }, [cleanupStreams])

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card voice-recorder-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px', width: '92vw', padding: '1.5rem', textAlign: 'center' }}
      >
        <div className="modal-header" style={{ justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: 'none', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mic size={18} className="text-accent" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Record Voice Memo</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => {
              cleanupStreams()
              onClose()
            }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.65rem', marginBottom: '1rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Audio Visualizer Canvas */}
        <div style={{ background: 'var(--input-bg)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--card-border)' }}>
          <canvas
            ref={canvasRef}
            width={340}
            height={64}
            style={{ width: '100%', height: '64px', display: 'block' }}
          />
          <div style={{ marginTop: '0.65rem', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: isRecording ? 'var(--danger)' : 'var(--text-primary)' }}>
            {isRecording ? `🔴 ${formatTime(recordingDuration)}` : formatTime(recordingDuration)}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          {!isRecording && !audioBlob && (
            <button
              type="button"
              className="btn-tool-action primary-yellow"
              style={{ borderRadius: '50px', padding: '0.85rem 1.75rem' }}
              onClick={startRecording}
            >
              <Mic size={18} />
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <button
              type="button"
              className="btn-tool-action"
              style={{ background: 'var(--danger)', color: '#fff', borderRadius: '50px', padding: '0.85rem 1.75rem' }}
              onClick={stopRecording}
            >
              <Square size={16} />
              <span>Stop Recording</span>
            </button>
          )}

          {audioBlob && !isRecording && (
            <>
              <button
                type="button"
                className="btn-tiny"
                style={{ width: '42px', height: '42px', borderRadius: '50%', padding: 0 }}
                onClick={togglePlayback}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button
                type="button"
                className="btn-tiny danger"
                style={{ width: '42px', height: '42px', borderRadius: '50%', padding: 0 }}
                onClick={() => {
                  cleanupStreams()
                  setAudioBlob(null)
                  setRecordingDuration(0)
                }}
                title="Discard & Re-record"
              >
                <Trash2 size={16} />
              </button>

              <button
                type="button"
                className="btn-tool-action primary-yellow"
                style={{ borderRadius: '50px', padding: '0.65rem 1.25rem' }}
                onClick={handleSaveAndAttach}
              >
                <Check size={16} />
                <span>Attach to Clip</span>
              </button>

              {audioUrl && (
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  style={{ display: 'none' }}
                />
              )}
            </>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          Direct device microphone recording. Zero cloud speech recognition or tracking.
        </p>
      </div>
    </div>
  )
}
