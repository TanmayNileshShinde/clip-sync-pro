import React, { useState, useMemo } from 'react'
import {
  X,
  Trash2,
  Star,
  Copy,
  Check,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Code2,
  Image as ImageIcon,
  FileDown,
  Clock,
  Paperclip,
} from 'lucide-react'
import type { HistoryItem } from '../types/clipboard'
import {
  toggleFavoriteHistory,
  removeHistoryItem,
  clearAllHistory,
} from '../services/clipStore'
import { playCopySound, playClickSound } from '../utils/sound'

function formatTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  history: HistoryItem[]
  onHistoryChange: (updated: HistoryItem[]) => void
  onSelectCode: (code: string) => void
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onHistoryChange,
  onSelectCode,
}) => {
  const [filter, setFilter] = useState<'all' | 'sent' | 'received' | 'starred'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Filter by tab
      if (filter === 'sent' && item.direction !== 'sent') return false
      if (filter === 'received' && item.direction !== 'received') return false
      if (filter === 'starred' && !item.favorite) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesCode = item.code.includes(q)
        const matchesPreview = item.preview?.toLowerCase().includes(q)
        const matchesName = item.name?.toLowerCase().includes(q)
        return matchesCode || matchesPreview || matchesName
      }

      return true
    })
  }, [history, filter, searchQuery])

  if (!isOpen) return null

  const handleCopy = async (item: HistoryItem) => {
    playCopySound()
    const content = item.clipData?.content || item.preview
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      // Fallback
    }
  }

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    const updated = toggleFavoriteHistory(id)
    onHistoryChange(updated)
  }

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    const updated = removeHistoryItem(id)
    onHistoryChange(updated)
  }

  const handleClearAll = () => {
    playClickSound()
    if (window.confirm('Clear all clip history?')) {
      clearAllHistory()
      onHistoryChange([])
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title">
            <Clock size={20} className="title-icon" />
            <h3>Clip History</h3>
            <span className="count-pill">{history.length}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="drawer-search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="drawer-search-input"
            placeholder="Search clips by code, text, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="drawer-filter-pills">
          <button
            type="button"
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({history.length})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'sent' ? 'active' : ''}`}
            onClick={() => setFilter('sent')}
          >
            Sent
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'received' ? 'active' : ''}`}
            onClick={() => setFilter('received')}
          >
            Received
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'starred' ? 'active' : ''}`}
            onClick={() => setFilter('starred')}
          >
            Starred
          </button>
        </div>

        {/* Clips List */}
        <div className="drawer-list">
          {filteredHistory.length === 0 ? (
            <div className="drawer-empty-state">
              <Clock size={40} className="empty-icon" />
              <p className="empty-title">No clips in history</p>
              <span className="empty-desc">
                {searchQuery
                  ? 'No results match your search query.'
                  : 'Items you send or retrieve will appear here for easy access.'}
              </span>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="history-row"
                onClick={() => {
                  playClickSound()
                  onSelectCode(item.code)
                  onClose()
                }}
                title="Click to view and retrieve clip"
              >
                {/* Direction and Type Icon */}
                <div className={`history-type-badge ${item.direction}`}>
                  {item.direction === 'sent' ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownLeft size={13} />
                  )}
                  {item.type === 'code' ? (
                    <Code2 size={13} />
                  ) : item.type === 'image' ? (
                    <ImageIcon size={13} />
                  ) : item.type === 'file' ? (
                    <FileDown size={13} />
                  ) : item.type === 'mixed' ? (
                    <Paperclip size={13} />
                  ) : (
                    <FileText size={13} />
                  )}
                </div>

                {/* Content info */}
                <div className="history-info">
                  <div className="history-top-line">
                    <button
                      type="button"
                      className="history-code-badge"
                      onClick={(e) => {
                        e.stopPropagation()
                        try {
                          navigator.clipboard.writeText(item.code)
                        } catch {
                          // Ignore
                        }
                        playCopySound()
                        setCopiedId(`code_${item.id}`)
                        setTimeout(() => setCopiedId(null), 1200)
                        onSelectCode(item.code)
                        onClose()
                      }}
                      title="Click to retrieve clip & copy PIN"
                    >
                      {copiedId === `code_${item.id}` ? `✓ #${item.code}` : `#${item.code}`}
                    </button>
                    <span className="history-time">{formatTime(item.timestamp)}</span>
                  </div>
                  <p className="history-preview-text">
                    {item.name ? `📎 ${item.name}` : item.preview}
                  </p>
                </div>

                {/* Actions */}
                <div className="history-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`history-action-btn ${copiedId === item.id ? 'copied' : ''}`}
                    onClick={() => handleCopy(item)}
                    title="Copy content"
                  >
                    {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    className={`history-action-btn star ${item.favorite ? 'starred' : ''}`}
                    onClick={(e) => handleToggleStar(item.id, e)}
                    title={item.favorite ? 'Unstar' : 'Star / Favorite'}
                  >
                    <Star size={14} fill={item.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="history-action-btn delete"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    title="Delete from history"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {history.length > 0 && (
          <div className="drawer-footer">
            <button type="button" className="btn-clear-history" onClick={handleClearAll}>
              <Trash2 size={14} /> Clear All History
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
