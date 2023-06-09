import debugLib from 'debug'
import pty from 'node-pty'
import os from 'node:os'
import type { Observer } from 'rxjs'
import { defaultBinaryPath, readSecondInputControlCharacters, redirectingStderrOutput } from './constants.js'

const debug = debugLib('langchain-alpaca:session')
const debugData = debugLib('langchain-alpaca:data')
const debugState = debugLib('langchain-alpaca:state')

export interface AlpacaCppChatParameters {
  /**
   * Working directory of dist file. Default to `path.join(path.dirname(require.resolve('langchain-alpaca')), 'binary')`.
   * If you are using esm, try set this to node_modules/langchain-alpaca/dist/binary
   */
  cwd: string
  /**
   * Name of alpaca.cpp binary
   */
  cmd: string
  shell: string
}

export interface QueueItem extends Observer<{ token: string; item: QueueItem }> {
  prompt: string
  /**
   * This item's prompt has already send to the LLM, now is waiting the output to complete.
   */
  doneInput: boolean
  /**
   * Shell will echo back once, should ignore this message
   */
  doneEcho: boolean
  /**
   * Does output of this item started, or we are just waiting for LLM to respond.
   */
  outputStarted: boolean
}

/**
 * Manage node-pty session that runs Alpaca.cpp
 */
export class AlpacaCppSession implements AlpacaCppChatParameters {
  /**
   * Working directory of dist file. Default to `.` . If you are using esm, try set this to node_modules/langchain-alpaca/dist
   */
  // eslint-disable-next-line unicorn/prefer-module
  cwd = defaultBinaryPath
  /**
   * Name of alpaca.cpp binary
   */
  cmd = os.platform() === 'win32' ? './chat.exe' : (os.platform() === 'darwin' ? './chat_mac' : './chat')
  shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

  ptyProcess: pty.IPty
  /**
   * Shell commands to Start alpaca.cpp in the pty session.
   */
  invocationParams: string

  /**
   * Done the first time startup, enter the `>` wait for input
   */
  doneInitialization = false
  queue: Array<QueueItem> = []

  constructor(invocationParameters: string, binaryParameter?: Partial<AlpacaCppChatParameters>) {
    debug(`constructor(${invocationParameters}, ${JSON.stringify(binaryParameter)})`)
    this.cwd = binaryParameter?.cwd ?? this.cwd
    this.cmd = binaryParameter?.cmd ?? this.cmd
    this.shell = binaryParameter?.shell ?? this.shell

    this.invocationParams = invocationParameters

    try {
      debug('pty.spawn')
      this.ptyProcess = pty.spawn(this.shell, [], {
        cwd: this.cwd,
      })
      debug('pty.spawn √')
    } catch (error) {
      console.error('caught error when init ptyProcess in AlpacaCppSession', error)
      throw error
    }
    this.initialization()
  }

  /**
   * Start alpaca.cpp in the pty session.
   */
  initialization() {
    debug('initialization')
    const commandToExecute = `${this.cmd} ${this.invocationParams}`
    debug(`initialization ${this.shell} exec: ${commandToExecute} in ${this.cwd}`)
    this.setListenerForQueue()
    this.ptyProcess.write(`${commandToExecute} \r`)
  }

  /**
   * A listener on the shell, that will pass data to "current item in the queue"'s callback
   */
  setListenerForQueue() {
    debug('setListenerForQueue')

    // refactor following code to state machine if gets too complicated
    this.ptyProcess.onData((data) => {
      const item = this.queue[0]
      // prevent JSON.stringify execution if not in debug mode
      process.env.DEBUG?.includes('langchain-alpaca') && debugState(
        `onData ${
          JSON.stringify({
            doneInit: this.doneInitialization,
            '>': readSecondInputControlCharacters.every(char => data.includes(char)),
            prompt: data.replace(/\s/g, '').includes(item?.prompt?.replace(/\s/g, '')),
            'queue[0]': { ...item, prompt: '' },
          })
        }`,
      )
      debugData(JSON.stringify(data))
      // this callback will be called line by line.
      // Some lines contains system out, some contains user input's echo by shell, some will be control characters.
      if (this.doneInitialization) {
        if (item === undefined) return
        if (item.outputStarted && readSecondInputControlCharacters.every(char => data.includes(char))) {
          // for the second time encounter `>` (after return result)
          // this means last item in the queue is finished the execution
          this.finishItemInQueue()
          item.complete()
          return
        }
        const prompt = item.prompt.replace(/\s/g, '')
        const cleanData = data.replace(/\s/g, '')
        if (!item.doneEcho && (cleanData.endsWith(prompt) || cleanData.includes(prompt))) {
          // shell will echo the input, we have to wait after the echo to receive the real input.
          item.doneEcho = true
          return
        }
        if (!item.doneInput) {
          this.processQueue()
          return
        }
        if (item.doneInput && item.doneEcho) {
          // finally, we are getting the real output of LLM

          // eslint-disable-next-line no-control-regex
          let token = data.replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
          if (!item.outputStarted) {
            // first token contains controlCharacter like `"\u001b[0mHello World!"`, need to remove it.
            token = token.replace(/\[[\d;]*[A-Za-z]/g, '')
            // if not empty after strip control characters, inform client that outputStarted is true
            token = token.replace(/\s/g, '')
            if (token) {
              item.outputStarted = true
            }
          }
          // give item's callback the latest output token, and current state in the queue item
          item.next({ token, item })
          return
        }
      } else if (!data.includes('chat') && readSecondInputControlCharacters.every(char => data.includes(char))) {
        // for the first time encounter `>` (ask for user input)
        debug('doneInitialization')
        this.doneInitialization = true
        this.processQueue()
      }
    })

    this.ptyProcess.onExit((result) => {
      debug(`pty exit ${JSON.stringify(result)}`)
      if (result.exitCode === 0) {
        debug(`pty exit successful`)
        // successful
      } else {
        const command = this.queue[0]
        command?.error(new Error(JSON.stringify(result)))
        console.error(`ptyProcess.onExit with error`, result)
        // something went wrong
      }
    })
  }

  processQueue() {
    debug(`processQueue() doneInitialization: ${this.doneInitialization}`)
    // wait for init, after init, callback in `this.setListenerForQueue` will call `processQueue`
    if (!this.doneInitialization) return
    if (this.queue.length === 0) {
      return
    }
    const command = this.queue[0]
    // safety check
    if (command === undefined) return
    if (command.doneInput) return
    // pass item's prompt to LLM
    const prompt = command.prompt.replace(/[\n\r]/g, '\\')
    debug(`processQueue() write prompt\n${JSON.stringify(prompt)}`)
    command.doneInput = true
    this.ptyProcess.write(`${prompt} \r`)
  }

  finishItemInQueue() {
    debug('finishItemInQueue')
    this.queue.shift()
  }

  /**
   * Chat with the LLM.
   *
   * Will insert current prompt into a queue, or execute immediately if queue is empty.
   * @param prompt Text input for the Chat LLM
   */
  execute(prompt: string, observer: Observer<{ token: string; item: QueueItem }>) {
    debug(`execute(${JSON.stringify(prompt)}) this.queue.length: ${this.queue.length}`)
    const noWaitingTask = this.queue.length === 0
    this.queue.push({
      prompt,
      doneInput: false,
      doneEcho: false,
      outputStarted: false,
      ...observer,
    })
    if (noWaitingTask) {
      this.processQueue()
    }
  }

  destroy() {
    this.ptyProcess.kill()
  }
}
