/* eslint-disable no-undef */
const binaryFolder = path.join(__dirname, '..', 'binary')

cd(`${__dirname}/../alpaca.cpp`)
let distPath = path.join(binaryFolder, 'chat.exe')
if (os.platform() === 'win32') {
  $.shell = 'pwsh'
  // https://github.com/antimatter15/alpaca.cpp#windows-setup
  // Note that this step should be done by the user of this package: Download and install CMake: https://cmake.org/download/
  await $`cmake .`
  await $`cmake --build . --config Release`
  await fs.copy('./Release/chat.exe', distPath)
} else if (os.platform() === 'darwin') {
  await $`make chat_mac`
  distPath = path.join(binaryFolder, 'chat_mac')
  await fs.copy('./chat_mac', distPath)
} else {
  await $`make`
  distPath = path.join(binaryFolder, 'chat')
  await fs.copy('./chat', distPath)
}
echo(`copied to ${distPath}`)