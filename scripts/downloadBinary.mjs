/* eslint-disable no-undef */
import { resolve } from 'node:path'
import { pipeline } from 'node:stream'

const binaryDownloadBasePath = `https://github.com/antimatter15/alpaca.cpp/releases/latest/download`

const binaryFolder = 'binary'

await fs.rm(binaryFolder, { recursive: true, force: true })
await fs.mkdir(binaryFolder)

const files = ['alpaca-linux.zip', 'alpaca-mac.zip', 'alpaca-win.zip']
await Promise.all(
  files.map(async (fileName) => {
    await fetch(`${binaryDownloadBasePath}/${fileName}`, {
      // headers: {
      //   'accept-encoding': 'gzip,deflate',
      // },
    }).then(
      (res) =>
        new Promise((resolve, reject) => {
          const dest = fs.createWriteStream(`./${binaryFolder}/${fileName}`)
          res.body.pipe(dest)
          dest.on('close', () => resolve())
          dest.on('error', reject)
        }),
    )
  }),
)

cd(binaryFolder)

await Promise.all(
  files.map(async (fileName) => {
    await $`unzip ./${fileName}`
  }),
)

await Promise.all(files.map(async (fileName) => fs.unlink(`./${fileName}`)))
