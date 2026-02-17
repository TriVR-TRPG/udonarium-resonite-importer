const { spawnSync } = require('node:child_process');

const platformArgs = {
  win32: ['--win', '--config.win.signAndEditExecutable=false'],
  darwin: ['--mac'],
  linux: ['--linux'],
};

const args = platformArgs[process.platform];
if (!args) {
  console.error(`Unsupported platform: ${process.platform}`);
  process.exit(1);
}

const executable = process.execPath;
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const commandArgs = [electronBuilderCli, ...args];

const result = spawnSync(executable, commandArgs, {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
