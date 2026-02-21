#!/usr/bin/env node
const { spawnSync } = require('child_process');

const platformToScript = {
  win32: 'package:cli:win',
  darwin: 'package:cli:mac',
  linux: 'package:cli:linux',
};

const script = platformToScript[process.platform];
if (!script) {
  console.error(`[package-cli-current] unsupported platform: ${process.platform}`);
  process.exit(1);
}

console.log(`[package-cli-current] running: npm run ${script}`);
const result = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
