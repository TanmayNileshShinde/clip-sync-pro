export type ClipType = 'text' | 'code' | 'image' | 'file' | 'mixed'

export interface ClipAttachment {
  id?: string
  content: string // data URL / base64
  name: string
  size: number
  mimeType: string
}

export interface ClipItem {
  code: string
  type: ClipType
  content: string // Text note / code / markdown
  attachments?: ClipAttachment[] // Array of multiple attached photos/files
  attachment?: ClipAttachment // Backwards compatibility for single attachment
  name?: string
  size?: number
  mimeType?: string
  isEncrypted?: boolean
  burnAfterRead?: boolean
  expiresAt: number
  createdAt: number
}

export interface HistoryItem {
  id: string
  code: string
  direction: 'sent' | 'received'
  type: ClipType
  preview: string
  name?: string
  size?: number
  timestamp: number
  favorite?: boolean
  attachmentCount?: number
  hasAttachment?: boolean
  attachmentName?: string
  clipData?: ClipItem
}

export type SyncStatus = 'connected' | 'connecting' | 'local-only'

export interface DevToolResult {
  title: string
  output: string
  isError?: boolean
}
