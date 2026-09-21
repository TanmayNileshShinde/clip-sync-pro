import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

// In-memory clip store for dev server & local network
const clips = new Map<string, ClipPayload>()

function clipApiPlugin(): Plugin {
  return {
    name: 'clip-api-server',
    configureServer(server) {
      // Periodic cleanup of expired clips (only active in dev server, unref'd so it never hangs)
      const cleanupTimer = setInterval(() => {
        const now = Date.now()
        for (const [code, clip] of clips.entries()) {
          if (clip.expiresAt > 0 && clip.expiresAt < now) {
            clips.delete(code)
          }
        }
      }, 30000)
      if (cleanupTimer.unref) cleanupTimer.unref()

      server.middlewares.use(async (req, res, next) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        const rawUrl = req.url || ''
        const url = rawUrl.split('?')[0].replace(/\/+$/, '')

        // POST /api/clip
        if (req.method === 'POST' && url === '/api/clip') {
          const chunks: Buffer[] = []
          req.on('data', (chunk) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
          })
          req.on('error', (err) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          })
          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8')
              const data = JSON.parse(body) as Partial<ClipPayload>
              let code = data.code?.trim() || ''

              if (!code || code.length !== 6 || isNaN(Number(code))) {
                // Generate a random 6-digit number
                do {
                  code = Math.floor(100000 + Math.random() * 900000).toString()
                } while (clips.has(code))
              }

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
                expiresAt: data.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
                createdAt: Date.now(),
              }

              clips.set(code, clip)

              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, code, clip }))
            } catch (err: unknown) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: (err as Error)?.message || 'Invalid JSON' }))
            }
          })
          return
        }

        // GET /api/clip/:code or /api/clip?code=:code
        if (req.method === 'GET' && (url.startsWith('/api/clip/') || url === '/api/clip')) {
          let code = url.replace('/api/clip/', '').replace('/api/clip', '').trim()
          if (!code && req.url) {
            try {
              const parsed = new URL(req.url, 'http://localhost')
              code = parsed.searchParams.get('code')?.trim() || ''
            } catch {
              // Ignore
            }
          }

          res.setHeader('Content-Type', 'application/json')
          if (!code || code.length !== 6) {
            res.statusCode = 400
            res.end(JSON.stringify({ success: false, error: 'Please provide a 6-digit code' }))
            return
          }

          const clip = clips.get(code)
          if (!clip) {
            res.statusCode = 404
            res.end(JSON.stringify({ success: false, error: 'Clip not found or expired' }))
            return
          }

          if (clip.expiresAt > 0 && clip.expiresAt < Date.now()) {
            clips.delete(code)
            res.statusCode = 404
            res.end(JSON.stringify({ success: false, error: 'Clip expired' }))
            return
          }

          // If burn after read, delete after this retrieval
          if (clip.burnAfterRead) {
            clips.delete(code)
          }

          res.statusCode = 200
          res.end(JSON.stringify({ success: true, clip }))
          return
        }

        // DELETE /api/clip/:code
        if (req.method === 'DELETE' && (url.startsWith('/api/clip/') || url === '/api/clip')) {
          let code = url.replace('/api/clip/', '').replace('/api/clip', '').trim()
          if (!code && req.url) {
            try {
              const parsed = new URL(req.url, 'http://localhost')
              code = parsed.searchParams.get('code')?.trim() || ''
            } catch {
              // Ignore
            }
          }
          const existed = code ? clips.delete(code) : false
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ success: true, deleted: existed }))
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), clipApiPlugin()],
  server: {
    host: true, // Allow external devices on local network (e.g. mobile phone) to connect
    port: 5173,
  },
})
