import { describe, it, expect } from 'vitest'
import {
  encryptPayload,
  decryptPayload,
  isEncryptedPayload,
  bufferToBase64,
  base64ToBuffer,
} from '../src/utils/crypto'

describe('AES-GCM 256 End-to-End Encryption', () => {
  it('encrypts and decrypts basic text correctly', async () => {
    const text = 'Hello ClipSync PRO! Cross-device encryption.'
    const password = 'mySecretPassword123!'

    const encrypted = await encryptPayload(text, password)
    expect(encrypted).toMatch(/^e2ee:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
    expect(isEncryptedPayload(encrypted)).toBe(true)

    const decrypted = await decryptPayload(encrypted, password)
    expect(decrypted).toBe(text)
  })

  it('handles multi-byte unicode characters and emojis', async () => {
    const text = '🚀 📋 Universal clipboard with 日本語, Español, and symbols: 🔒 €£¥₹'
    const pin = '991204'

    const encrypted = await encryptPayload(text, pin)
    const decrypted = await decryptPayload(encrypted, pin)
    expect(decrypted).toBe(text)
  })

  it('handles complex nested JSON payloads (attachments + text)', async () => {
    const payload = JSON.stringify({
      text: 'Meeting notes & credentials',
      attachments: [
        {
          name: 'screenshot.png',
          mimeType: 'image/png',
          size: 4096,
          content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ],
    })
    const password = 'enterprise-pin-404'

    const encrypted = await encryptPayload(payload, password)
    const decrypted = await decryptPayload(encrypted, password)
    expect(decrypted).toBe(payload)

    const parsed = JSON.parse(decrypted)
    expect(parsed.text).toBe('Meeting notes & credentials')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0].name).toBe('screenshot.png')
  })

  it('rejects decryption when given an incorrect password', async () => {
    const text = 'Highly sensitive secret data'
    const encrypted = await encryptPayload(text, 'correctPassword')

    await expect(decryptPayload(encrypted, 'wrongPassword')).rejects.toThrow(
      'Incorrect password or corrupted data'
    )
  })

  it('rejects malformed or tampered encrypted payloads', async () => {
    await expect(decryptPayload('not-an-encrypted-string', 'pass')).rejects.toThrow(
      'Invalid encryption payload format'
    )

    await expect(decryptPayload('e2ee:v1:too:few:parts:here:extra', 'pass')).rejects.toThrow(
      'Malformed encrypted data'
    )

    // Tampered ciphertext
    const encrypted = await encryptPayload('Test payload', 'password')
    const parts = encrypted.split(':')
    // Modify the ciphertext part
    parts[4] = 'AAAA' + parts[4].slice(4)
    const tampered = parts.join(':')

    await expect(decryptPayload(tampered, 'password')).rejects.toThrow(
      'Incorrect password or corrupted data'
    )
  })

  it('correctly identifies valid and invalid encrypted payload signatures', () => {
    expect(isEncryptedPayload('e2ee:v1:salt:iv:cipher')).toBe(true)
    expect(isEncryptedPayload('e2ee:v2:something')).toBe(false)
    expect(isEncryptedPayload('plain text content')).toBe(false)
    expect(isEncryptedPayload(null)).toBe(false)
    expect(isEncryptedPayload(undefined)).toBe(false)
    expect(isEncryptedPayload(12345)).toBe(false)
  })

  it('handles base64 buffer conversions for empty and large chunks', () => {
    const emptyBuf = new ArrayBuffer(0)
    expect(bufferToBase64(emptyBuf)).toBe('')
    expect(base64ToBuffer('').byteLength).toBe(0)

    const sample = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128])
    const b64 = bufferToBase64(sample.buffer)
    const roundtrip = new Uint8Array(base64ToBuffer(b64))
    expect(Array.from(roundtrip)).toEqual(Array.from(sample))
  })
})
