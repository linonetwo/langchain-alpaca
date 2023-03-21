/**
 * Example from official doc, change LLM to Alpaca.cpp
 * @url https://hwchase17.github.io/langchainjs/docs/modules/chains/llm_chain
 */
/* eslint-disable no-undef */
import { LLMChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain/prompts'
import path from 'node:path'
import { AlpacaCppChat } from '../dist/index.js'

const template = 'What is a good name for a company that makes {product}?'
const prompt = new PromptTemplate({
  template: template,
  inputVariables: ['product'],
})

const alpaca = new AlpacaCppChat({
  cwd: path.join(__dirname, '../dist'),
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin') },
})

const chain = new LLMChain({ llm: alpaca, prompt: prompt })
const response = await chain.call({ product: 'colorful socks' })
console.log(`response`, response, JSON.stringify(response))
alpaca.closeSession()
