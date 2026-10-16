import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

interface ClipPayload {
  code: string
  type: 'text' | 'code' | 'image' | 'file' | 'mixed'
  content: string
  attachment?: {
    content: string
    name: string
    size: number
    mimeType: string
  }
  attachments?: Array<{
    id?: string
    content: string
    name: string
    size: number
    mimeType: string
  }>
  name?: string
  size?: number
  mimeType?: string
  isEncrypted?: boolean
  burnAfterRead?: boolean
  expiresAt: number
  createdAt: number
}

// In-memory fallback cache across warm serverless instances
const globalStore = globalThis as unknown as {
  __clips_cache__?: Map<string, ClipPayload>
}
if (!globalStore.__clips_cache__) {
  globalStore.__clips_cache__ = new Map<string, ClipPayload>()
}
const memoryClips = globalStore.__clips_cache__

// Periodic cleanup helper to prevent memory bloat on warm serverless instances
function pruneMemoryClips() {
  const now = Date.now()
  for (const [code, clip] of memoryClips.entries()) {
    if (clip.expiresAt > 0 && clip.expiresAt < now) {
      memoryClips.delete(code)
    }
  }
  // Cap max stored clips to 1,000 items with FIFO eviction
  if (memoryClips.size > 1000) {
    const keysToEvict = Array.from(memoryClips.keys()).slice(0, memoryClips.size - 800)
    for (const k of keysToEvict) {
      memoryClips.delete(k)
    }
  }
}

// Upstash / Vercel KV REST helpers (active if user links Vercel KV / Upstash Redis)
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

async function saveToRedis(key: string, value: ClipPayload, ttlSeconds: number) {
  if (!redisUrl || !redisToken) return
  try {
    const serialized = JSON.stringify(value)
    // Upstash REST API: POST /set/{key}?ex={seconds} with serialized string in body
    const res = await fetch(`${redisUrl}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serialized),
    })
    if (!res.ok) {
      console.error('Redis save non-ok status:', res.status, await res.text())
    }
  } catch (err) {
    console.error('Redis save error:', err)
  }
}

async function getFromRedis(key: string): Promise<ClipPayload | null> {
  if (!redisUrl || !redisToken) return null
  try {
    const res = await fetch(`${redisUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: string | null }
    if (!data.result) return null
    try {
      return JSON.parse(data.result) as ClipPayload
    } catch {
      return data.result as unknown as ClipPayload
    }
  } catch (err) {
    console.error('Redis get error:', err)
    return null
  }
}

async function deleteFromRedis(key: string) {
  if (!redisUrl || !redisToken) return
  try {
    await fetch(`${redisUrl}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    })
  } catch {
    // Ignore
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security and CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Run periodic maintenance
  pruneMemoryClips()

  // POST: Create a new clip
  if (req.method === 'POST') {
    try {
      const data = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Partial<ClipPayload>
      let code = data.code?.trim() || ''

      // Validate or generate random 6-digit numeric code
      if (!code || !/^\d{6}$/.test(code)) {
        do {
          code = Math.floor(100000 + Math.random() * 900000).toString()
        } while (memoryClips.has(code))
      }

      // Safe lifespan bounds: default 24h, min 1 min, max 7 days
      const maxExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000
      const minExpiry = Date.now() + 60 * 1000
      const requestedExpiry = Number(data.expiresAt) || (Date.now() + 24 * 60 * 60 * 1000)
      const expiresAt = Math.min(Math.max(minExpiry, requestedExpiry), maxExpiry)

      const attachments = data.attachments || (data.attachment ? [data.attachment] : undefined)
      const clip: ClipPayload = {
        code,
        type: data.type || 'text',
        content: data.content || '',
        attachment: data.attachment || (attachments && attachments[0]),
        attachments,
        name: data.name || (attachments && attachments[0]?.name),
        size: data.size || (attachments ? attachments.reduce((acc, c) => acc + (c.size || 0), 0) : undefined),
        mimeType: data.mimeType || (attachments && attachments[0]?.mimeType),
        isEncrypted: !!data.isEncrypted,
        burnAfterRead: !!data.burnAfterRead,
        expiresAt,
        createdAt: Date.now(),
      }

      // 1. Save in serverless memory
      memoryClips.set(code, clip)

      // 2. Save in Vercel KV / Upstash Redis if configured
      const ttlSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
      await saveToRedis(`clip:${code}`, clip, ttlSec)

      return res.status(200).json({ success: true, code, clip })
    } catch (err: unknown) {
      return res.status(400).json({ success: false, error: (err as Error)?.message || 'Invalid payload' })
    }
  }

  // Extract code from query or URL
  let codeParam = (req.query.code as string)?.trim() || ''
  if (!codeParam && req.url) {
    const pathPart = req.url.split('?')[0].replace('/api/clip/', '').replace('/api/clip', '').trim()
    if (/^\d{6}$/.test(pathPart)) {
      codeParam = pathPart
    }
  }

  // GET: Retrieve clip by code
  if (req.method === 'GET') {
    if (!codeParam || !/^\d{6}$/.test(codeParam)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid 6-digit numeric code' })
    }

    // 1. Try serverless memory
    let clip = memoryClips.get(codeParam) || null

    // 2. Try Redis / KV if not in memory
    if (!clip) {
      clip = await getFromRedis(`clip:${codeParam}`)
    }

    if (!clip) {
      return res.status(404).json({ success: false, error: 'Clip not found or expired' })
    }

    if (clip.expiresAt > 0 && clip.expiresAt < Date.now()) {
      memoryClips.delete(codeParam)
      await deleteFromRedis(`clip:${codeParam}`)
      return res.status(404).json({ success: false, error: 'Clip has expired' })
    }

    // Handle burn after read
    if (clip.burnAfterRead) {
      memoryClips.delete(codeParam)
      await deleteFromRedis(`clip:${codeParam}`)
    }

    return res.status(200).json({ success: true, clip })
  }

  // DELETE: Remove clip
  if (req.method === 'DELETE') {
    if (codeParam && /^\d{6}$/.test(codeParam)) {
      memoryClips.delete(codeParam)
      await deleteFromRedis(`clip:${codeParam}`)
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
