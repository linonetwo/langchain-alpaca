import { describe, it } from 'vitest'
import { AlpacaCppChat } from '../src/index.js'

describe('AlpacaCppChat class', () => {
	it('Loads LLM', async ({ expect }) => {
		const alpaca = new AlpacaCppChat()
		const response = await alpaca.generate(['Tell me a joke. End with "Joke EOF".'])
		expect(response.generations[0].join('\n')).toContain('Joke')
	})
})
