import { execSync } from 'node:child_process'
import os from 'node:os'

export const escapeNewLine = (cliArgument: string) =>
  os.platform() === 'win32' ? cliArgument.replaceAll(/\n/g, '\\n').replaceAll(/\r/g, '\\r') : cliArgument
export const escapeDoubleQuotes = (cliArgument: string) =>
  os.platform() === 'win32' ? cliArgument.replaceAll(/"/g, '`"') : cliArgument.replaceAll(/"/g, '\\"')

const exec = (cmd: string) => {
  return execSync(cmd, { encoding: 'utf8' })
}
export function getPhysicalCore() {
  let physicalCores = 0

  switch (os.platform()) {
    case 'linux': {
      physicalCores = Number.parseInt(exec('lscpu -p | egrep -v "^#" | sort -u -t, -k 2,4 | wc -l').trim(), 10)
      break
    }
    case 'darwin': {
      physicalCores = Number.parseInt(exec('sysctl -n hw.physicalcpu_max').trim(), 10)
      break
    }
    case 'win32': {
      physicalCores = exec('WMIC CPU Get NumberOfCores')
        .split(os.EOL)
        .map((line) => {
          return Number.parseInt(line)
        })
        .filter((value) => {
          return !Number.isNaN(value)
        })
        .reduce((sum, number) => {
          return sum + number
        }, 0)
      break
    }
    default: {
      physicalCores = os.cpus().filter((cpu, index) => {
        return !cpu.model.includes('Intel') || index % 2 === 1
      }).length
    }
  }
  return physicalCores
}
