/* eslint-disable unicorn/no-array-reduce */
import { BaseLanguageModelParams } from 'langchain/dist/base_language/index.js'
import { BaseCache } from 'langchain/dist/cache.js'
import { LLM } from 'langchain/llms'
import pty from 'node-pty'
import os from 'node:os'
import { escapeDoubleQuotes, escapeNewLine } from './utils.js'

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

export interface AlpacaCppChatParameters {
  /**
   * Working directory of dist file. Default to __dirname. If you are using esm, try set this to node_modules/langchain-alpaca/dist
   */
  cwd: string
  /**
   * Name of alpaca.cpp binary
   */
  cmd: string
  shell: string
}

/**
 * Wrapper around binary executable that loads alpaca model
 *
 * @augments BaseLLM
 */
export class AlpacaCppChat extends LLM implements AlpacaCppChatParameters {
  modelParams: AlpacaCppModelParameters = {
    interactive: false,
    model: '../model/ggml-alpaca-7b-q4.bin',
    // More CPU makes it slow, don't know why.
    // https://github.com/antimatter15/alpaca.cpp/issues/61#issuecomment-1476518558
    threads: Math.min(4, os.cpus().length),
  }

  /**
   * Working directory of dist file. Default to __dirname. If you are using esm, try set this to node_modules/langchain-alpaca/dist
   */
  // eslint-disable-next-line unicorn/prefer-module
  cwd = __dirname
  /**
   * Name of alpaca.cpp binary
   */
  cmd = os.platform() === 'win32' ? './binary/chat.exe' : (os.platform() === 'darwin' ? './binary/chat_mac' : './binary/chat')
  shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
  /**
   * Ignore diagnostic outputs
   * https://github.com/ggerganov/llama.cpp/pull/48
   */
  redirectingStderrOutput = os.platform() === 'win32' ? '2>&1 > $null' : '2>/dev/null'
  /**
	 * The character output when alpaca wants user input
	 * https://gist.github.com/dominikwilkowski/60eed2ea722183769d586c76f22098dd
	 * >
			data "\u001b[33m\r\n> "
			data.startsWith('>') false
			data.startsWith('') false
			onMessage0
			data "\u001b[1m\u001b[32m"
			data.startsWith('>') false
			data.startsWith('\u001b[1m\u001b[32m') true
	 */
  // eslint-disable-next-line unicorn/escape-case
  readInputControlCharacter = '\u001b[33m'
  // eslint-disable-next-line unicorn/escape-case
  outputStartControlCharacter = '\u001b[0m'
  /**
   * It prints this after the answer, and wait for second user input
   * "\u001b[0m\r\n> \u001b[1m\u001b[32m"
   *
   * But it will be on output for first time:
   * "\u001b[0mHello"
   *
   * So have to check `\r\n>` too.
   */
  // eslint-disable-next-line unicorn/escape-case
  readSecondInputControlCharacter = this.outputStartControlCharacter + '\r\n>'

  constructor(
    fields?: BaseLLMParams & Partial<AlpacaCppChatParameters> & { modelParameters?: Partial<AlpacaCppModelParameters> },
  ) {
    super(fields ?? {})
    this.modelParams = { ...this.modelParams, ...fields?.modelParameters }

    this.cwd = fields?.cwd ?? this.cwd
    this.cmd = fields?.cmd ?? this.cmd
    this.shell = fields?.shell ?? this.shell
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
    if (this.modelParams.interactive !== true) {
      const parameters = this.invocationParams({ prompt })
      let completion = ''
      const onceCallback = (ptyProcess: pty.IPty, data: string) => {
        completion += data
      }
      await this.executeAlpacaCppBinary(prompt, parameters, onceCallback)
      return completion.replace(this.outputStartControlCharacter, '')
    }
    // completion = await new Promise<string>((resolve, reject) => {
    // 	let innerCompletion = ''
    // 	const parser = createParser((event) => {
    // 		if (event.type === 'event') {
    // 			if (event.data === '[DONE]') {
    // 				resolve(innerCompletion)
    // 			} else {
    // 				const response = JSON.parse(event.data) as {
    // 					id: string
    // 					object: string
    // 					created: number
    // 					model: string
    // 					choices: Array<{
    // 						index: number
    // 						finish_reason: string | null
    // 						delta: { content?: string; role?: string }
    // 					}>
    // 				}

    // 				const part = response.choices[0]
    // 				if (part != undefined) {
    // 					innerCompletion += part.delta?.content ?? ''
    // 					// eslint-disable-next-line no-void
    // 					void this.callbackManager.handleLLMNewToken(part.delta?.content ?? '', true)
    // 				}
    // 			}
    // 		}
    // 	})

    // 	// workaround for incorrect axios types
    // 	const stream = data as unknown as IncomingMessage
    // 	stream.on('data', (data: Buffer) => parser.feed(data.toString('utf-8')))
    // 	stream.on('error', (error) => reject(error))
    // })
    return ''
  }

  async executeAlpacaCppBinary(
    prompt: string,
    parameters: string,
    onMessage: (ptyProcess: pty.IPty, data: string) => void,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const commandToExecute = `${this.cmd} ${parameters} ${this.redirectingStderrOutput}`
      console.log(`${this.shell} exec: ${commandToExecute} in ${this.cwd}`)
      let ptyProcess: pty.IPty

      try {
        ptyProcess = pty.spawn(this.shell, [], {
          cwd: this.cwd,
        })
      } catch (error) {
        console.error('caught error when init ptyProcess', error)
        return reject(false)
      }
      try {
        ptyProcess.onExit((result) => {
          if (result.exitCode === 0) {
            // successful
            resolve(true)
          } else {
            console.error(`ptyProcess.onExit with error`, result)
            // something went wrong
            reject(false)
          }
        })
        ptyProcess.write(`${commandToExecute} \r`)
        let doneLoading = false
        let doneInput = false
        ptyProcess.onData((data) => {
          if (doneLoading) {
            if (data.startsWith(prompt)) {
              // shell will echo the input, we have to wait after the echo to receive the real input.
              doneInput = true
              return
            }
            if (data.includes(this.readSecondInputControlCharacter)) {
              // for the second time encounter `>` (after return result)
              ptyProcess.kill()
              return
            }
            if (doneInput) {
              onMessage?.(ptyProcess, data)
              return
            }
          } else if (data.includes(this.readInputControlCharacter)) {
            // for the first time encounter `>` (ask for user input)
            doneLoading = true
            ptyProcess.write(`${prompt} \r`)
          }
        })
      } catch (error) {
        console.error('caught error in executeAlpacaCppBinary after ptyProcess initialization', error)
        ptyProcess.kill()
        // ptyProcess.write("exit\r")
      }
    })
  }

  _llmType() {
    return 'alpaca.cpp'
  }
}
