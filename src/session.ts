import pty from 'node-pty'
import os from 'node:os'
import type { Observer } from 'rxjs'
import { readInputControlCharacter, readSecondInputControlCharacter, redirectingStderrOutput } from './constants.js'

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

export interface QueueItem extends Observer<string> {
  prompt: string
  doneInput: boolean
}

/**
 * Manage node-pty session that runs Alpaca.cpp
 */
export class AlpacaCppSession implements AlpacaCppChatParameters {
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
    this.cwd = binaryParameter?.cwd ?? this.cwd
    this.cmd = binaryParameter?.cmd ?? this.cmd
    this.shell = binaryParameter?.shell ?? this.shell

    this.invocationParams = invocationParameters

    try {
      this.ptyProcess = pty.spawn(this.shell, [], {
        cwd: this.cwd,
      })
    } catch (error) {
      console.error('caught error when init ptyProcess in AlpacaCppSession', error)
      throw error
    }
    this.ptyProcess.onExit((result) => {
      if (result.exitCode === 0) {
        // successful
      } else {
        console.error(`ptyProcess.onExit with error`, result)
        // something went wrong
      }
    })
  }

  /**
   * Start alpaca.cpp in the pty session.
   */
  initialization() {
    const commandToExecute = `${this.cmd} ${this.invocationParams} ${redirectingStderrOutput}`
    console.log(`${this.shell} exec: ${commandToExecute} in ${this.cwd}`)
    this.setListenerForQueue()
    this.ptyProcess.write(`${commandToExecute} \r`)
  }

  /**
   * A listener on the shell, that will pass data to "current item in the queue"'s callback
   */
  setListenerForQueue() {
    this.ptyProcess.onData((data) => {
      // this callback will be called line by line.
      // Some lines contains system out, some contains user input's echo by shell, some will be control characters.
      if (this.doneInitialization) {
        if (data.includes(readSecondInputControlCharacter)) {
          // for the second time encounter `>` (after return result)
          // this means last item in the queue is finished the execution
          this.finishItemInQueue()
          return
        }
        const command = this.queue[0]
        if (command === undefined) return
        if (!command.doneInput) {
          this.processQueue()
          return
        }
        if (data.startsWith(command.prompt)) {
          // shell will echo the input, we have to wait after the echo to receive the real input.
          command.doneInput = true
          return
        }
        if (command.doneInput) {
          // finally, we are getting the real output of LLM
          command.next(data)
          return
        }
      } else if (data.includes(readInputControlCharacter)) {
        // for the first time encounter `>` (ask for user input)
        this.doneInitialization = true
        this.processQueue()
      }
    })
  }

  processQueue() {
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
    this.ptyProcess.write(`${command.prompt} \r`)
  }

  finishItemInQueue() {
    this.queue.shift()
  }

  /**
   * Chat with the LLM.
   *
   * Will insert current prompt into a queue, or execute immediately if queue is empty.
   * @param prompt Text input for the Chat LLM
   */
  execute(prompt: string, observer: Observer<string>) {
    const noWaitingTask = this.queue.length === 0
    this.queue.push({
      prompt,
      doneInput: false,
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
