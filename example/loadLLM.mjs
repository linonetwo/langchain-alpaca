/* eslint-disable no-undef */
import path from 'node:path'
import { AlpacaCppChat, getPhysicalCore } from '../dist/index.js'

console.time('LoadAlpaca')
const alpaca = new AlpacaCppChat({
  // example: save one core for electron renderer
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin'), threads: getPhysicalCore() - 1 },
})
const response = await alpaca.generate(['Say "hello world"']).catch((error) => console.error(error))
console.timeEnd('LoadAlpaca')

console.log(`response`, response, JSON.stringify(response))
alpaca.closeSession()
