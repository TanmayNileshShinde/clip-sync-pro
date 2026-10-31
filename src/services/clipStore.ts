import { Peer } from 'peerjs'
import type { ClipItem, HistoryItem } from '../types/clipboard'

const BROADCAST_NAME = 'clipsync_channel'
const LOCAL_STORAGE_KEY = 'clipsync_clips'
const HISTORY_STORAGE_KEY = 'clipsync_history'
const MAX_LOCAL_STORAGE_BYTES = 250 * 1024 // 250KB max for localStorage to avoid 5MB browser quota crashes

// Active PeerJS instance for hosting clips over WebRTC
let hostPeer: Peer | null = null

// Broadcast channel for cross-tab sync on same device
let broadcastChannel: BroadcastChannel | null = null
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_NAME)
  } catch {
    broadcastChannel = null
  }
}

// Local Storage Helper
function getLocalClips(): Record<string, ClipItem> {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveLocalClip(clip: ClipItem) {
  if (typeof localStorage === 'undefined') return
  // storage guard
  const totalAttachmentBytes =
    (clip.attachments?.reduce((acc, a) => acc + (a.content?.length || a.size || 0), 0) || 0) +
    (clip.attachment?.content?.length || clip.attachment?.size || 0)
  if ((clip.content?.length || 0) + totalAttachmentBytes > MAX_LOCAL_STORAGE_BYTES) return

  try {
    const clips = getLocalClips()
    clips[clip.code] = clip
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clips))
  } catch {
    // quota prune
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    } catch {
      // ignore error
    }
  }
}

function removeLocalClip(code: string) {
  if (typeof localStorage === 'undefined') return
  try {
    const clips = getLocalClips()
    delete clips[code]
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clips))
  } catch {
    // ignore error
  }
}

// History Management
export function getClipHistory(): HistoryItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addClipHistory(
  clip: ClipItem,
  direction: 'sent' | 'received'
): HistoryItem {
  const attCount = clip.attachments?.length || (clip.attachment ? 1 : 0)
  const primaryName = clip.attachments?.[0]?.name || clip.attachment?.name || clip.name

  let preview = ''
  if (attCount > 0 && clip.content) {
    preview = `${clip.content.slice(0, 80)} [📎 ${attCount} file${attCount > 1 ? 's' : ''}]`
  } else if (attCount > 0) {
    preview = `📎 ${primaryName || 'Attachments'} (${attCount})`
  } else if (clip.type === 'text' || clip.type === 'code') {
    preview = clip.content.slice(0, 120)
  } else if (clip.type === 'image') {
    preview = primaryName || 'Image clip'
  } else {
    preview = primaryName || 'File attachment'
  }

  // trim history
  const safeClipData: ClipItem = {
    ...clip,
    content: clip.content.length > 50000 ? '' : clip.content,
    attachment: clip.attachment ? { ...clip.attachment, content: '' } : undefined,
    attachments: clip.attachments ? clip.attachments.map((a) => ({ ...a, content: '' })) : undefined,
  }

  const newItem: HistoryItem = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    code: clip.code,
    direction,
    type: clip.type,
    preview,
    name: primaryName,
    size: clip.size || clip.attachment?.size,
    hasAttachment: attCount > 0,
    attachmentName: primaryName,
    attachmentCount: attCount,
    timestamp: Date.now(),
    favorite: false,
    clipData: safeClipData,
  }

  // deduplicate history
  const history = getClipHistory()
  const filtered = history.filter((h) => h.code !== clip.code)
  const updated = [newItem, ...filtered].slice(0, 50)

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // storage recovery
    try {
      const trimmed = updated.slice(0, 10).map((h) => ({ ...h, clipData: undefined }))
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // ignore error quota error so user flow is never blocked
    }
  }

  return newItem
}

export function toggleFavoriteHistory(id: string): HistoryItem[] {
  const history = getClipHistory().map((item) => {
    if (item.id === id) {
      return { ...item, favorite: !item.favorite }
    }
    return item
  })
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch {
    // ignore error
  }
  return history
}

export function removeHistoryItem(id: string): HistoryItem[] {
  const history = getClipHistory().filter((item) => item.id !== id)
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch {
    // ignore error
  }
  return history
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY)
  } catch {
    // ignore error
  }
}

// Generate unique 6-digit code
export function generateRandomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Helper to send data chunked over WebRTC DataChannel (supports multi-MB files)
function sendDataChunked(conn: any, clip: ClipItem) {
  try {
    const jsonStr = JSON.stringify(clip)
    const CHUNK_SIZE = 16384 // 16KB safe cross-browser WebRTC DataChannel chunk
    const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE)

    if (totalChunks <= 1) {
      conn.send({ type: 'CLIP_PAYLOAD', clip })
      return
    }

    // send header
    conn.send({
      type: 'CLIP_STREAM_START',
      totalChunks,
      totalBytes: jsonStr.length,
      code: clip.code,
    })

    // stream chunks
    let chunkIdx = 0
    const streamNextBatch = () => {
      for (let i = 0; i < 4 && chunkIdx < totalChunks; i++, chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, jsonStr.length)
        conn.send({
          type: 'CLIP_STREAM_CHUNK',
          chunkIdx,
          totalChunks,
          data: jsonStr.slice(start, end),
        })
      }
      if (chunkIdx < totalChunks) {
        setTimeout(streamNextBatch, 8)
      } else {
        conn.send({ type: 'CLIP_STREAM_END', code: clip.code })
      }
    }
    streamNextBatch()
  } catch (err) {
    console.warn('P2P chunked streaming send error:', err)
  }
}

// Setup P2P Host for a clip (supports unlimited file sizes via streaming)
function setupPeerHost(clip: ClipItem) {
  try {
    if (hostPeer && !hostPeer.destroyed) {
      hostPeer.destroy()
    }

    const peerId = `clipsync-${clip.code}`
    hostPeer = new Peer(peerId, {
      debug: 0,
    })

    hostPeer.on('connection', (conn) => {
      conn.on('open', () => {
        sendDataChunked(conn, clip)
        if (clip.burnAfterRead) {
          setTimeout(() => {
            if (hostPeer) hostPeer.destroy()
          }, 3000)
        }
      })
    })

    hostPeer.on('error', () => {
      // peer collision
    })
  } catch {
    // ignore error P2P setup errors in restricted network
  }
}

// Fetch clip via P2P with chunked streaming assembly
async function fetchViaPeer(code: string, timeoutMs = 3500): Promise<ClipItem | null> {
  return new Promise((resolve) => {
    let resolved = false
    let clientPeer: Peer | null = null

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (clientPeer) clientPeer.destroy()
        resolve(null)
      }
    }, timeoutMs)

    try {
      clientPeer = new Peer({ debug: 0 })

      clientPeer.on('open', () => {
        const conn = clientPeer!.connect(`clipsync-${code}`)
        let receivedChunks: string[] = []
        let expectedChunks = 0

        conn.on('data', (raw: unknown) => {
          const msg = raw as any
          if (msg?.type === 'CLIP_PAYLOAD' && msg.clip) {
            if (!resolved) {
              resolved = true
              clearTimeout(timer)
              clientPeer?.destroy()
              resolve(msg.clip)
            }
          } else if (msg?.type === 'CLIP_STREAM_START') {
            expectedChunks = msg.totalChunks
            receivedChunks = new Array(expectedChunks)
            window.dispatchEvent(
              new CustomEvent('clipsync:p2p-progress', {
                detail: { progress: 0, totalBytes: msg.totalBytes },
              })
            )
          } else if (msg?.type === 'CLIP_STREAM_CHUNK') {
            receivedChunks[msg.chunkIdx] = msg.data
            const currentCount = receivedChunks.filter(Boolean).length
            window.dispatchEvent(
              new CustomEvent('clipsync:p2p-progress', {
                detail: { progress: Math.round((currentCount / expectedChunks) * 100) },
              })
            )
          } else if (msg?.type === 'CLIP_STREAM_END') {
            try {
              const fullJson = receivedChunks.join('')
              const parsedClip = JSON.parse(fullJson) as ClipItem
              window.dispatchEvent(
                new CustomEvent('clipsync:p2p-progress', { detail: { progress: 100 } })
              )
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                clientPeer?.destroy()
                resolve(parsedClip)
              }
            } catch (e) {
              console.error('Failed to parse chunked clip payload:', e)
            }
          }
        })
      })

      clientPeer.on('error', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          clientPeer?.destroy()
          resolve(null)
        }
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

// Send / Create Clip
export async function sendClip(clipData: Omit<ClipItem, 'createdAt'>): Promise<ClipItem> {
  const fullClip: ClipItem = {
    ...clipData,
    createdAt: Date.now(),
  }

  // local save
  saveLocalClip(fullClip)

  // cross broadcast
  if (broadcastChannel) {
    try {
      // meta broadcast
      if (fullClip.content.length < 500 * 1024) {
        broadcastChannel.postMessage({ type: 'NEW_CLIP', clip: fullClip })
      } else {
        broadcastChannel.postMessage({
          type: 'NEW_CLIP',
          clip: { ...fullClip, content: '' },
        })
      }
    } catch {
      // ignore error
    }
  }

  // host p2p
  setupPeerHost(fullClip)

  // cloud upload
  const totalSerializedSize = JSON.stringify(fullClip).length
  if (totalSerializedSize <= 4.2 * 1024 * 1024) {
    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullClip),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.clip) {
          addClipHistory(data.clip, 'sent')
          return data.clip
        }
      }
    } catch {
      // p2p fallback
    }
  }

  // large payload
  addClipHistory(fullClip, 'sent')
  return fullClip
}

// Retrieve Clip by 6-digit Code
export async function retrieveClip(code: string): Promise<ClipItem> {
  const cleanCode = code.trim()
  if (!cleanCode || cleanCode.length !== 6) {
    throw new Error('Please enter a valid 6-digit code')
  }

  // local lookup
  const localClips = getLocalClips()
  const localClip = localClips[cleanCode]
  if (localClip) {
    if (localClip.expiresAt > 0 && localClip.expiresAt < Date.now()) {
      removeLocalClip(cleanCode)
    } else {
      return localClip
    }
  }

  // history lookup
  const history = getClipHistory()
  const historyItem = history.find((h) => h.code === cleanCode)
  if (historyItem) {
    if (historyItem.clipData && (!historyItem.clipData.expiresAt || historyItem.clipData.expiresAt > Date.now())) {
      return historyItem.clipData
    }
    // restore meta
    if (historyItem.preview || historyItem.name) {
      const reconstructed: ClipItem = {
        code: historyItem.code,
        type: historyItem.type,
        content: historyItem.clipData?.content || historyItem.preview || '',
        name: historyItem.name,
        size: historyItem.size,
        createdAt: historyItem.timestamp,
        expiresAt: 0,
        burnAfterRead: false,
        isEncrypted: false,
        attachment: historyItem.clipData?.attachment,
        attachments: historyItem.clipData?.attachments,
      }
      return reconstructed
    }
  }

  // cloud fetch
  try {
    const res = await fetch(`/api/clip/${cleanCode}`)
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.clip) {
        saveLocalClip(data.clip)
        addClipHistory(data.clip, 'received')
        return data.clip
      }
    }
  } catch {
    // peer fallback
  }

  // p2p direct
  try {
    const p2pClip = await fetchViaPeer(cleanCode, 1500)
    if (p2pClip) {
      saveLocalClip(p2pClip)
      addClipHistory(p2pClip, 'received')
      return p2pClip
    }
  } catch {
    // fall through
  }

  throw new Error('No active clip found for code: ' + cleanCode)
}

// Subscribe to cross-tab updates
export function subscribeToCrossTabClips(callback: (clip: ClipItem) => void): () => void {
  if (!broadcastChannel) return () => {}

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NEW_CLIP' && event.data.clip) {
      callback(event.data.clip)
    }
  }

  broadcastChannel.addEventListener('message', handler)
  return () => {
    broadcastChannel?.removeEventListener('message', handler)
  }
}
