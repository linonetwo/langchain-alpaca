import os from 'node:os'

export const escapeNewLine = (cliArgument: string) =>
  os.platform() === 'win32' ? cliArgument.replaceAll(/\n/g, '\\n').replaceAll(/\r/g, '\\r') : cliArgument
export const escapeDoubleQuotes = (cliArgument: string) =>
  os.platform() === 'win32' ? cliArgument.replaceAll(/"/g, '`"') : cliArgument.replaceAll(/"/g, '\\"')
