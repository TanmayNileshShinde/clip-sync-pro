import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Download, Volume2 } from 'lucide-react'
import { playClickSound } from '../utils/sound'

interface AudioPlayerItemProps {
  src: string
  name: string
  size?: number
}

export const AudioPlayerItem: React.FC<AudioPlayerItemProps> = ({ src, name, size }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    playClickSound()
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  useEffect(() => {
    const audioEl = audioRef.current
    return () => {
      if (audioEl) {
        audioEl.pause()
      }
    }
  }, [])

  const formatSecs = (s: number) => {
    if (isNaN(s)) return '00:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    playClickSound()
    const a = document.createElement('a')
    a.href = src
    a.download = name || 'voice_memo.webm'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className="audio-player-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        background: 'var(--input-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '0.85rem 1rem',
        width: '100%',
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        className="btn-tiny"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          color: '#000',
          border: 'none',
          padding: 0,
          flexShrink: 0,
        }}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice memo' : 'Play voice memo'}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
      </button>

      {/* Middle info + Scrubber */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Volume2 size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            {name || 'Voice Memo'} {size ? `(${(size / 1024).toFixed(0)} KB)` : ''}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {formatSecs(currentTime)} / {formatSecs(duration)}
          </span>
        </div>

        {/* Progress Bar / Scrubber */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: 'var(--accent-primary)',
            height: '4px',
          }}
        />
      </div>

      {/* Download Action */}
      <button
        type="button"
        className="btn-tiny"
        style={{ flexShrink: 0, padding: '0.4rem 0.6rem' }}
        onClick={handleDownload}
        title="Download Audio"
      >
        <Download size={14} />
      </button>
    </div>
  )
}
