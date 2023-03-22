/**
 * Example from official doc, change LLM to Alpaca.cpp
 * @url https://hwchase17.github.io/langchainjs/docs/modules/chains/llm_chain
 */
/* eslint-disable no-undef */
import { loadQAStuffChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import path from 'node:path'
import { AlpacaCppChat } from '../dist/index.js'

const alpaca = new AlpacaCppChat({
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin') },
})

const chain = loadQAStuffChain(alpaca)
const docs = [
  new Document({ pageContent: 'harrison went to harvard' }),
  new Document({ pageContent: 'ankush went to princeton' }),
]
const response = await chain.call({
  input_documents: docs,
  question: 'Where did harrison go to college',
})
echo(JSON.stringify(response))
alpaca.closeSession()
if (os.platform() === 'win32') {
  // it seems not quit only on windows.
  process.exit(0)
}