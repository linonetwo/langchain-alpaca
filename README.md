# LangChain-Alpaca

Run alpaca LLM fully locally in langchain.

```ts
import path from 'node:path';
import { AlpacaCppChat } from 'langchain-alpaca';

const alpaca = new AlpacaCppChat({ modelParameters: { model: 'locationToYourModel' } });
const response = await alpaca.generate(['Say "hello world"']).catch((error) => console.error(error));

console.log(`response`, response, JSON.stringify(response));
```

See `example/loadLLM.mjs` for a simple example, run it with `zx example/loadLLM.mjs`

## Parameter of AlpacaCppChat

```ts
interface AlpacaCppModelParameters {
  /** run in interactive mode
   * (This also means to stream the results in langchain)
   */
  interactive?: boolean;
  /** run in interactive mode and poll user input at startup */
  interactiveStart?: boolean;
  /** in interactive mode, poll user input upon seeing PROMPT */
  reversePrompt?: string | null;
  /** colorise output to distinguish prompt and user input from generations */
  color?: boolean;
  /** RNG seed (default: -1) */
  seed?: number;
  /** number of threads to use during computation (default: %d) */
  threads?: number;
  /** prompt to start generation with (default: random) */
  prompt?: string | null;
  /** prompt file to start generation */
  file?: string | null;
  /** number of tokens to predict (default: %d) */
  n_predict?: number;
  /** top-k sampling (default: %d) */
  top_k?: number;
  /** top-p sampling (default: %.1f) */
  top_p?: number;
  /** last n tokens to consider for penalize (default: %d) */
  repeat_last_n?: number;
  /** penalize repeat sequence of tokens (default: %.1f) */
  repeat_penalty?: number;
  /** size of the prompt context (default: %d) */
  ctx_size?: number;
  /** temperature (default: %.1f) */
  temp?: number;
  /** batch size for prompt processing (default: %d) */
  batch_size?: number;
  /** model path, absolute or relative location of `ggml-alpaca-7b-q4.bin` model file (default: %s) */
  model?: string;
}

interface AlpacaCppChatParameters {
  /**
   * Working directory of dist file. Default to __dirname. If you are using esm, try set this to node_modules/langchain-alpaca/dist
   */
  cwd: string;
  /**
   * Name of alpaca.cpp binary
   */
  cmd: string;
  shell: string;
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
