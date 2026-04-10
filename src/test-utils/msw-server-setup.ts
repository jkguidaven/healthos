/**
 * Helper for tests that need to mock Claude API calls.
 *
 * Usage:
 *   import { setupMswServer } from '@/test-utils/msw-server-setup'
 *
 *   describe('my test', () => {
 *     setupMswServer()
 *     // ...
 *   })
 *
 * Note: msw v2 has ESM transitive dependencies that Jest 29 cannot
 * transform out of the box. If you hit a parse error when first using
 * this, the fix is to add the offending package to transformIgnorePatterns
 * in jest.config.js.
 */
import { server } from './msw-server'

export function setupMswServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}
