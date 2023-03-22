/* eslint-disable no-undef */
import path from 'node:path'
import { AlpacaCppChat, getPhysicalCore } from '../dist/index.js'

console.time('LoadAlpaca')
let alpaca = new AlpacaCppChat({
  // example: save one core for electron renderer
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin'), threads: getPhysicalCore() - 1 },
})
let response = await alpaca.generate(['2+2=?', '1+1=?']).catch((error) => console.error(error))
console.timeEnd('LoadAlpaca')

echo(JSON.stringify(response))

// continue chat with it
response = await alpaca.generate(['Only say "hello world"']).catch((error) => console.error(error))
echo(JSON.stringify(response))

// close the node-tty session to free the memory used by alpaca.cpp. You can query alpaca as much as you want before closing it.
alpaca.closeSession()
if (os.platform() === 'win32') {
  // it seems not quit only on windows.
  process.exit(0)
}