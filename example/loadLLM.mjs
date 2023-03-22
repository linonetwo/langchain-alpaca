/* eslint-disable no-undef */
import path from 'node:path'
import { AlpacaCppChat, getPhysicalCore } from '../dist/index.js'

console.time('LoadAlpaca')
let alpaca = new AlpacaCppChat({
  // example: save one core for electron renderer
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin'), threads: getPhysicalCore() - 1 },
})
let questions = ['2+2=', '1+1=']
echo(questions)
let response = await alpaca.generate(questions).catch((error) => console.error(error))
console.timeEnd('LoadAlpaca')

echo(JSON.stringify(response))

// continue chat with it
questions = ['Only say "hello world", I say "hello", you said:']
echo(questions)
response = await alpaca.generate(questions).catch((error) => console.error(error))
echo(JSON.stringify(response))

// close the node-tty session to free the memory used by alpaca.cpp. You can query alpaca as much as you want before closing it.
alpaca.closeSession()
if (os.platform() === 'win32') {
  // it seems not quit only on windows.
  process.exit(0)
}