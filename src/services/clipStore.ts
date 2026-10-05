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
  // Don't save large binary/image payloads to localStorage (they live on the server & in memory)
  const totalAttachmentBytes =
    (clip.attachments?.reduce((acc, a) => acc + (a.content?.length || a.size || 0), 0) || 0) +
    (clip.attachment?.content?.length || clip.attachment?.size || 0)
  if ((clip.content?.length || 0) + totalAttachmentBytes > MAX_LOCAL_STORAGE_BYTES) return

  try {
    const clips = getLocalClips()
    clips[clip.code] = clip
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clips))
  } catch {
    // Quota exceeded: clear non-essential cache
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    } catch {
      // Ignore
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
    // Ignore
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

  // Create lightweight copy of clipData without giant base64 payloads to protect quota
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

  // Deduplicate by code and prepend
  const history = getClipHistory()
  const filtered = history.filter((h) => h.code !== clip.code)
  const updated = [newItem, ...filtered].slice(0, 50)

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage might be full, trim down aggressively
    try {
      const trimmed = updated.slice(0, 10).map((h) => ({ ...h, clipData: undefined }))
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // Ignore quota error so user flow is never blocked
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
    // Ignore
  }
  return history
}

export function removeHistoryItem(id: string): HistoryItem[] {
  const history = getClipHistory().filter((item) => item.id !== id)
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Ignore
  }
  return history
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

// Generate unique 6-digit code
export function generateRandomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Setup P2P Host for a clip
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
        // WebRTC DataChannels fail if message exceeds ~256KB; check total serialized size
        const totalSize = JSON.stringify(clip).length
        if (totalSize < 64 * 1024) {
          try {
            conn.send({ type: 'CLIP_PAYLOAD', clip })
          } catch {
            // Ignore
          }
        }
        if (clip.burnAfterRead) {
          setTimeout(() => {
            if (hostPeer) hostPeer.destroy()
          }, 1000)
        }
      })
    })

    hostPeer.on('error', () => {
      // Peer ID collision or network fallback
    })
  } catch {
    // Ignore P2P setup errors in restricted network
  }
}

// Fetch clip via P2P
async function fetchViaPeer(code: string, timeoutMs = 2000): Promise<ClipItem | null> {
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
        conn.on('data', (data: unknown) => {
          const payload = data as { type: string; clip: ClipItem }
          if (payload?.type === 'CLIP_PAYLOAD' && payload.clip) {
            if (!resolved) {
              resolved = true
              clearTimeout(timer)
              clientPeer?.destroy()
              resolve(payload.clip)
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

  // 1. Save to Local Storage if reasonably small
  saveLocalClip(fullClip)

  // 2. Broadcast across tabs
  if (broadcastChannel) {
    try {
      // If content is very large, broadcast metadata only to prevent browser structured clone buffer errors
      if (fullClip.content.length < 500 * 1024) {
        broadcastChannel.postMessage({ type: 'NEW_CLIP', clip: fullClip })
      } else {
        broadcastChannel.postMessage({
          type: 'NEW_CLIP',
          clip: { ...fullClip, content: '' },
        })
      }
    } catch {
      // Ignore
    }
  }

  // 3. Setup WebRTC P2P Host if total content safely fits in data channel
  const totalClipSize = JSON.stringify(fullClip).length
  if (totalClipSize < 64 * 1024) {
    setupPeerHost(fullClip)
  }

  // 4. Send to Vite / API server (handles binary/image payloads smoothly)
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
    } else {
      let errMsg = 'Failed to upload clip to server'
      try {
        const errJson = await res.json()
        if (errJson.error) errMsg = errJson.error
      } catch {
        if (res.status === 413) {
          errMsg = 'Payload too large for cloud server (limit 4.5MB). Please attach smaller photos or files.'
        } else {
          errMsg = `Server error (HTTP ${res.status}): ${res.statusText || 'Upload failed'}`
        }
      }
      throw new Error(errMsg)
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message) {
      throw err
    }
    throw new Error('Could not connect to clipboard server. Please check your network connection.')
  }

  // Record history safely and return
  addClipHistory(fullClip, 'sent')
  return fullClip
}

// Retrieve Clip by 6-digit Code
export async function retrieveClip(code: string): Promise<ClipItem> {
  const cleanCode = code.trim()
  if (!cleanCode || cleanCode.length !== 6) {
    throw new Error('Please enter a valid 6-digit code')
  }

  // 1. Check LocalStorage cache first (sub-millisecond instant retrieval for local & history clips)
  const localClips = getLocalClips()
  const localClip = localClips[cleanCode]
  if (localClip) {
    if (localClip.expiresAt > 0 && localClip.expiresAt < Date.now()) {
      removeLocalClip(cleanCode)
    } else {
      return localClip
    }
  }

  // 2. Check History Cache (ensures clicking any item from History always opens smoothly)
  const history = getClipHistory()
  const historyItem = history.find((h) => h.code === cleanCode)
  if (historyItem) {
    if (historyItem.clipData && (!historyItem.clipData.expiresAt || historyItem.clipData.expiresAt > Date.now())) {
      return historyItem.clipData
    }
    // Reconstruct clip from history metadata if full clipData was trimmed for storage quota
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

  // 3. Try Server API (cloud synced clips from other devices)
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
    // Fall through to peer
  }

  // 4. Try WebRTC P2P direct data channel
  try {
    const p2pClip = await fetchViaPeer(cleanCode, 1500)
    if (p2pClip) {
      saveLocalClip(p2pClip)
      addClipHistory(p2pClip, 'received')
      return p2pClip
    }
  } catch {
    // Fall through
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
