const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'lib/resonitelink.js/dist/index.js',
  'lib/resonitelink.js/dist/index.d.ts',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)));

if (missing.length > 0) {
  console.error('[setup required] ResoniteLink submodule is not built.');
  console.error('Run: npm run setup:resonitelink');
  console.error('Missing files:');
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}
