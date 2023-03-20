import path from 'node:path'
import { describe, it } from 'vitest'
import { AlpacaCppChat } from '../src/index.js'
/**
 * Test not working until https://github.com/microsoft/node-pty/issues/579#issuecomment-1476416977 solved.
 */
describe('AlpacaCppChat class', () => {
  it('Loads LLM', async ({ expect }) => {
    // eslint-disable-next-line unicorn/prefer-module
    const alpaca = new AlpacaCppChat({ cwd: path.join(__dirname, '../dist') })
    const response = await alpaca.generate(['Say "hello world"'])
    expect(response.generations[0][0].text.toLowerCase()).toContain('hello world')
  }, { timeout: 50_000 })
})
