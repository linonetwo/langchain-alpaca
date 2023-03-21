/* eslint-disable unicorn/no-array-reduce */
import debugLib from 'debug'
import { BaseLanguageModelParams } from 'langchain/dist/base_language/index.js'
import { BaseCache } from 'langchain/dist/cache.js'
import { LLM } from 'langchain/llms'
import os from 'node:os'
import { AlpacaCppChatParameters, AlpacaCppSession } from './session.js'
import { escapeDoubleQuotes, escapeNewLine } from './utils.js'

const debug = debugLib('langchain-alpaca:llm')

/**
 * Usage of `./chat` binary
 * @param {string} url https://github.com/antimatter15/alpaca.cpp/blob/99f3908c515c73c7acbda307565234f33ec9738d/utils.cpp#L76-L103
 */
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

// eslint-disable-next-line unicorn/prevent-abbreviations
interface BaseLLMParams extends BaseLanguageModelParams {
  concurrency?: number
  cache?: BaseCache | boolean
}

export interface AlpacaCppChatLLMParameters {
  modelParameters: Partial<AlpacaCppModelParameters>
  streaming: boolean
}

/**
 * Wrapper around binary executable that loads alpaca model
 *
 * @augments BaseLLM
 */
export class AlpacaCppChat extends LLM {
  modelParams: AlpacaCppModelParameters = {
    interactive: false,
    model: '../model/ggml-alpaca-7b-q4.bin',
    // More CPU makes it slow, don't know why.
    // https://github.com/antimatter15/alpaca.cpp/issues/61#issuecomment-1476518558
    threads: Math.min(4, os.cpus().length),
  }
  binaryParameter?: Partial<AlpacaCppChatParameters>

  session?: AlpacaCppSession
  streaming = false

  constructor(
    configs?: BaseLLMParams & Partial<AlpacaCppChatParameters> & Partial<AlpacaCppChatLLMParameters>,
  ) {
    debug('constructor super')
    super(configs ?? {})
    debug('constructor')
    this.modelParams = { ...this.modelParams, ...configs?.modelParameters }
    this.binaryParameter = configs
    this.newSession()
    this.streaming = configs?.streaming ?? this.streaming
  }

  /**
	 * Get the parameters used to invoke the model
	 *
	 * I have a JSON like

			```ts
			const aaa = {
					interactive: false,
					model: 'ggml-alpaca-13b-q4.bin',
				}
			```

			use `.reduce` to make it into cli params like `--interactive=false --model="ggml-alpaca-13b-q4.bin"`
	 */
  invocationParams(additional?: Partial<AlpacaCppModelParameters>): string {
    return Object.entries({ ...this.modelParams, ...additional }).reduce((accumulator, [key, value]) => {
      if (!value) return accumulator
      if (value === true) return `${accumulator} --${key}`
      return `${accumulator} --${key} ${typeof value === 'string' ? `"${escapeDoubleQuotes(escapeNewLine(value))}"` : String(value)} `
    }, '').trim()
  }

  newSession() {
    debug('newSession')
    // release previous session if existed
    this.closeSession()
    // create a session to local alpaca.cpp binary using shell
    // invocationParams can have `prompt` field, but that is only for first execution, so we are not using it. Instead, we passing prompt using `this.session.execute`
    this.session = new AlpacaCppSession(this.invocationParams(), this.binaryParameter)
  }

  /**
   * Close the session (Release LLM process) manually.
   *
   * You can't call this LLM when session is closed.
   */
  closeSession() {
    if (this.session !== undefined) {
      debug('closeSession')
      this.session.destroy()
    }
  }

  /**
   * Call out to local alpaca.cpp with k unique prompts
   *
   * @param prompt - The prompt to pass into the model.
   * @param [stop] - Optional list of stop words to use when generating.
   *
   * @returns The full LLM output.
   *
   * @example
   * ```ts
   * import { AlpacaCppChat } from "langchain-alpaca";
   * const alpaca = new AlpacaCppChat();
   * const response = await alpaca.generate(["Tell me a joke."]);
   * ```
   */
  async _call(prompt: string, _stop?: string[]): Promise<string> {
    debug(`_call(${prompt})`)
    if (this.session === undefined) {
      this.newSession()
    }
    if (this.streaming) {
      return ''
    }
    return new Promise((resolve, reject) => {
      let completion = ''
      this.session?.execute(prompt, {
        next: ({ token }) => {
          completion += token
        },
        complete: () => resolve(completion),
        error: (error) => reject(error),
      })
    })
  }

  _llmType() {
    return 'alpaca.cpp'
  }
}
