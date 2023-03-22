const binaryFolder = path.join(__dirname, '..', 'binary')

cd('../alpaca.cpp')
let distPath = path.join(binaryFolder, 'chat.exe')
if (os.platform() === 'win32') {
  // https://github.com/antimatter15/alpaca.cpp#windows-setup
  // Note that this step should be done by the user of this package: Download and install CMake: https://cmake.org/download/
  await $`cmake .`
  await $`cmake --build . --config Release`
  await fs.copy('./chat.exe', distPath)
} else {
  await $`make chat`
  if (os.platform() === 'darwin') {
    distPath = path.join(binaryFolder, 'chat_mac')
    await fs.copy('./chat', distPath)
  } else {
    distPath = path.join(binaryFolder, 'chat')
    await fs.copy('./chat', distPath)
  }
}
echo(`copied to ${distPath}`)
