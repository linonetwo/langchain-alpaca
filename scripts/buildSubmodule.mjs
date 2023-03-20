const distFolder = path.join(__dirname, '..', 'dist');

cd('../alpaca.cpp');
if (os.type().toLowerCase() === 'windows_nt') {
  // https://github.com/antimatter15/alpaca.cpp#windows-setup
  // Note that this step should be done by the user of this package: Download and install CMake: https://cmake.org/download/
  await $`cmake .`;
  await $`cmake --build . --config Release`;
  await fs.copy('./chat.exe', path.join(distFolder, 'chat.exe'));
} else {
  await $`make chat`;
  await fs.copy('./chat', path.join(distFolder, 'chat'));
}
