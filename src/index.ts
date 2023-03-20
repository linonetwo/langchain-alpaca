import { BaseLanguageModelParams } from 'langchain/dist/base_language/index.js'
import { BaseCache } from 'langchain/dist/cache.js'
import { LLM } from 'langchain/llms'
import pty from 'node-pty'
import os from 'node:os'

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
	/** model path, absolute or relative location of `ggml-alpaca-13b-q4.bin` model file (default: %s) */
	model?: string
}

// eslint-disable-next-line unicorn/prevent-abbreviations
interface BaseLLMParams extends BaseLanguageModelParams {
	concurrency?: number
	cache?: BaseCache | boolean
}

/**
 * Wrapper around binary executable that loads alpaca model
 *
 * @augments BaseLLM
 */
export class AlpacaCppChat extends LLM {
	modelParams: AlpacaCppModelParameters = {
		interactive: false,
		model: 'ggml-alpaca-13b-q4.bin',
	}

	/**
	 * Working directory to execute alpaca.cpp binary
	 */
	// eslint-disable-next-line unicorn/prefer-module
	cwd = __dirname
	/**
	 * Name of binary
	 */
	cmd = os.platform() === 'win32' ? 'chat.exe' : 'chat'
	shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

	constructor(
		fields?: BaseLLMParams,
		modelParameters?: Partial<AlpacaCppModelParameters>,
	) {
		super(fields ?? {})
		this.modelParams = { ...this.modelParams, ...modelParameters }
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
			return accumulator + `--${key}=${typeof value === 'string' ? `"${value}"` : String(value)} `
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
				completion = data
			}
			await this.executeAlpacaCppBinary(parameters, onceCallback)
			return completion
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
		parameters: string,
		onMessage: (ptyProcess: pty.IPty, data: string) => void,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			console.log(`exec: ${this.cmd} in ${this.cwd}`)
			const ptyProcess = pty.spawn(this.shell, [], {
				cwd: this.cwd,
			})
			try {
				ptyProcess.onData((data) => {
					onMessage?.(ptyProcess, data)
				})
				ptyProcess.onExit((result) => {
					if (result.exitCode === 0) {
						// successful
						resolve(true)
					} else {
						// something went wrong
						reject(false)
					}
				})
				ptyProcess.write(`${this.cmd} ${parameters} \r`)
				ptyProcess.write('exit\r')
			} catch (error) {
				console.log('caught error', error)
				ptyProcess.kill()
				// ptyProcess.write("exit\r")
			}
		})
	}

	_llmType() {
		return 'alpaca.cpp'
	}
}
