// Browser Native SubtleCrypto AES-GCM 256 End-to-End Encryption
// Optimized with chunking for large files & images (up to 50MB+)

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000 // 32KB chunks prevents call stack overflow & memory freeze
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    // Convert chunk to string
    let str = ''
    for (let j = 0; j < sub.length; j++) {
      str += String.fromCharCode(sub[j])
    }
    chunks.push(str)
  }
  return btoa(chunks.join(''))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPayload(plaintext: string, pinOrPass: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pinOrPass, salt)

  const enc = new TextEncoder()
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plaintext)
  )

  const saltB64 = bufferToBase64(salt.buffer as ArrayBuffer)
  const ivB64 = bufferToBase64(iv.buffer as ArrayBuffer)
  const cipherB64 = bufferToBase64(cipherBuffer)

  return `e2ee:v1:${saltB64}:${ivB64}:${cipherB64}`
}

export async function decryptPayload(payload: string, pinOrPass: string): Promise<string> {
  if (!payload.startsWith('e2ee:v1:')) {
    throw new Error('Invalid encryption payload format')
  }

  const parts = payload.split(':')
  if (parts.length !== 5) {
    throw new Error('Malformed encrypted data')
  }

  const [, , saltB64, ivB64, cipherB64] = parts
  const salt = new Uint8Array(base64ToBuffer(saltB64))
  const iv = new Uint8Array(base64ToBuffer(ivB64))
  const cipherBuffer = base64ToBuffer(cipherB64)

  const key = await deriveKey(pinOrPass, salt)

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      cipherBuffer
    )

    const dec = new TextDecoder()
    return dec.decode(decryptedBuffer)
  } catch {
    throw new Error('Incorrect password or corrupted data')
  }
}

export function isEncryptedPayload(str: string): boolean {
  return typeof str === 'string' && str.startsWith('e2ee:v1:')
}
