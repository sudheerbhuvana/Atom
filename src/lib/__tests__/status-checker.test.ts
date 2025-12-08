import { checkServiceStatus } from '../status-checker'

// Mock tcp-ping
jest.mock('tcp-ping', () => ({
  ping: jest.fn((options, callback) => {
    callback(null, {
      results: [{ time: 10 }]
    })
  })
}))

describe('Status Checker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock fetch globally
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('checkServiceStatus', () => {
    it('should handle external URLs with fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      })

      const result = await checkServiceStatus('https://example.com')

      expect(result.up).toBe(true)
      expect(result.status).toBe(200)
      expect(result.method).toBe('fetch')
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle failed external requests', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await checkServiceStatus('https://example.com')

      expect(result.up).toBe(false)
      expect(result.status).toBe(0)
      expect(result.method).toBe('fetch')
      expect(result.error).toBeDefined()
    })

    it('should handle invalid URLs', async () => {
      const result = await checkServiceStatus('not-a-url')

      expect(result.up).toBe(false)
      expect(result.status).toBe(0)
      expect(result.method).toBe('fetch')
    })
  })
})

