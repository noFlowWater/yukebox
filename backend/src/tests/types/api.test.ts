import { describe, it, expect } from 'vitest'
import { ok, fail } from '../../types/api.js'

describe('api response helpers', () => {
  it('should create success response', () => {
    const response = ok({ id: 1, name: 'test' })
    expect(response.success).toBe(true)
    expect(response.data).toEqual({ id: 1, name: 'test' })
  })

  it('should create error response', () => {
    const response = fail('NOT_FOUND', 'Item not found')
    expect(response.success).toBe(false)
    expect(response.error.code).toBe('NOT_FOUND')
    expect(response.error.message).toBe('Item not found')
  })

  it('should handle null data in success response', () => {
    const response = ok(null)
    expect(response.success).toBe(true)
    expect(response.data).toBeNull()
  })
})
