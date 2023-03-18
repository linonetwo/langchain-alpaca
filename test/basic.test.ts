import { expect, test } from 'vitest'
import { message } from '../src/constants.js'

test("message contains 'Hello'", () => {
	expect(message).toContain('Hello')
})
