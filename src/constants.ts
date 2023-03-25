import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

/**
 * Ignore diagnostic outputs
 * https://github.com/ggerganov/llama.cpp/pull/48
 */
export const redirectingStderrOutput = os.platform() === 'win32' ? '2>&1 > $null' : '2>/dev/null'
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
// export const readInputControlCharacter = '\u001b[33m'
/**
 * It prints this after the answer, and wait for second user input
 * "\u001b[0m\r\n> \u001b[1m\u001b[32m"
 *
 * But it will be on output for first time:
 * "\u001b[0mHello"
 *
 * So have to check `\r\n>` too.
 * 
 * In Windows, it is "\r" "\n>\u001b[1C" "\u001b[1mu001b[92m" , different to macOS
 * 
 * Might also be "\r" "\u001b[1m\u001b[92m\n\u001b[m>\u001b[1C"
 * 
 * But might also be triggered by
 * 
 *  "PS E:\\repo\\langchain-alpaca\\dist\\binary> ./chat.exe --model \"e:\\repo\\langchain-a\r\nlpaca\\model\\ggml-alpaca-13b-q4.bin\"  --threads 6 2>&1 > $null\u001b[K\r\n"
 */
// eslint-disable-next-line unicorn/escape-case
export const readSecondInputControlCharacters = ['\u001b', '\n','>']

export const defaultBinaryPath = `/${new URL('binary/', import.meta.url).pathname.slice(1)}`;