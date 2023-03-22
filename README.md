# LangChain-Alpaca

Run alpaca LLM fully locally in langchain.

```shell
pnpm i langchain-alpaca
```

You can store following example as `loadLLM.mjs` , run it with google/zx by `DEBUG=langchain-alpaca:* zx './loadLLM.mjs'`

```ts
/* eslint-disable no-undef */
import { AlpacaCppChat, getPhysicalCore } from 'langchain-alpaca'
import path from 'node:path'

console.time('LoadAlpaca')
const alpaca = new AlpacaCppChat({
  // replace this with your local model path.
  modelParameters: { model: '/Users/linonetwo/Desktop/model/LanguageModel/ggml-alpaca-7b-q4.bin', threads: getPhysicalCore() - 1 },
})
const response = await alpaca.generate(['Say "hello world"']).catch((error) => console.error(error))
console.timeEnd('LoadAlpaca')

console.log(`response`, response, JSON.stringify(response))
// close the node-tty session to free the memory used by alpaca.cpp. You can query alpaca as much as you want before closing it.
alpaca.closeSession()
```

See `example/*.mjs` for more examples. Run with env `DEBUG=langchain-alpaca:*` will show internal debug details, useful when you found this LLM not responding to input.

Read [doc of LangChainJS](https://hwchase17.github.io/langchainjs/docs/overview/) to learn how to build a fully localized free AI workflow for you.

## Parameter of AlpacaCppChat

```ts
export interface AlpacaCppModelParameters {
  /** run in interactive mode
   * (This also means to stream the results in langchain)
   */
  interactive?: boolean
  /** run in interactive mode and poll user input at startup */
  interactiveStart?: boolean
  /** in interactive mode, poll user input upon seeing PROMPT */
  reversePrompt?: string | null
  /** colorise output to distinguish prompt and user input from generations */
  color?: boolean
  /** RNG seed (default: -1) */
  seed?: number
  /** number of threads to use during computation (default: %d) */
  threads?: number
  /** prompt to start generation with (default: random) */
  prompt?: string | null
  /** prompt file to start generation */
  file?: string | null
  /** number of tokens to predict (default: %d) */
  n_predict?: number
  /** top-k sampling (default: %d) */
  top_k?: number
  /** top-p sampling (default: %.1f) */
  top_p?: number
  /** last n tokens to consider for penalize (default: %d) */
  repeat_last_n?: number
  /** penalize repeat sequence of tokens (default: %.1f) */
  repeat_penalty?: number
  /** size of the prompt context (default: %d) */
  ctx_size?: number
  /** temperature (default: %.1f) */
  temp?: number
  /** batch size for prompt processing (default: %d) */
  batch_size?: number
  /** model path, absolute or relative location of `ggml-alpaca-7b-q4.bin` model file (default: %s) */
  model?: string
}

export interface AlpacaCppChatParameters {
  /**
   * Working directory of dist file. Default to `path.join(path.dirname(require.resolve('langchain-alpaca')), 'binary')`.
   * If you are using esm, try set this to node_modules/langchain-alpaca/dist/binary
   *
  cwd: string
  /**
   * Name of alpaca.cpp binary
   */
  cmd: string
  shell: string
}
```

Use params like this:

```ts
new AlpacaCppChat({ fields?: BaseLLMParams & Partial<AlpacaCppChatParameters> & { modelParameters?: Partial<AlpacaCppModelParameters> })
```

Where `BaseLLMParams` is from `langchain` core package.

## Development

During dev, you can put your model (or `ln -s` it) in the `model/ggml-alpaca-7b-q4.bin`.

And run the `zx example/loadLLM.mjs` to test it.
