import { describe, it, expect } from 'vitest'
import { generateRandomCode } from '../src/services/clipStore'

describe('Clip Utilities & Store', () => {
  it('generates a 6-digit numeric pairing code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRandomCode()
      expect(code).toMatch(/^\d{6}$/)
      const num = Number(code)
      expect(num).toBeGreaterThanOrEqual(100000)
      expect(num).toBeLessThan(1000000)
    }
  })

  it('generates well-distributed distinct codes', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      codes.add(generateRandomCode())
    }
    // In 100 random 6-digit codes, duplicates should be virtually zero
    expect(codes.size).toBeGreaterThanOrEqual(95)
  })
})
