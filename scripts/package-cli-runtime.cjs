#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--exe') {
      args.exe = value;
      i += 1;
    } else if (key === '--bundle') {
      args.bundle = value;
      i += 1;
    } else if (key === '--target') {
      args.target = value;
      i += 1;
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[package-cli-runtime] skip missing: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

function copyMatchingDirs(rootDir, regex, destBaseDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const copied = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !regex.test(entry.name)) {
      continue;
    }
    const src = path.join(rootDir, entry.name);
    const dest = path.join(destBaseDir, entry.name);
    copyIfExists(src, dest);
    copied.push(entry.name);
  }
  return copied;
}

function ensureSharpAddonEntry(packageDir) {
  const directNodeFile = path.join(packageDir, 'sharp.node');
  const libDir = path.join(packageDir, 'lib');
  if (!fs.existsSync(libDir)) {
    return false;
  }
  const libEntries = fs.readdirSync(libDir);
  const nodeFiles = libEntries.filter((file) => file.endsWith('.node'));
  if (!fs.existsSync(directNodeFile)) {
    if (nodeFiles.length === 0) {
      return false;
    }
    fs.copyFileSync(path.join(libDir, nodeFiles[0]), directNodeFile);
  }
  for (const file of libEntries) {
    if (!file.endsWith('.dll')) {
      continue;
    }
    const src = path.join(libDir, file);
    const dest = path.join(packageDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
  return true;
}

function main() {
  const { exe, bundle, target } = parseArgs(process.argv);
  if (!exe || !bundle) {
    console.error(
      'Usage: node scripts/package-cli-runtime.cjs --exe <path> --bundle <dir> [--target win|mac|linux]'
    );
    process.exit(1);
  }

  const exePath = path.resolve(exe);
  let bundleDir = path.resolve(bundle);
  let zipPath = `${bundleDir}.zip`;
  const exeName = path.basename(exePath);

  if (!fs.existsSync(exePath)) {
    console.error(`[package-cli-runtime] executable not found: ${exePath}`);
    process.exit(1);
  }

  try {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  } catch (error) {
    const suffix = Date.now();
    bundleDir = `${bundleDir}-${suffix}`;
    zipPath = `${bundleDir}.zip`;
    console.warn(
      `[package-cli-runtime] could not clean bundle dir, using fallback: ${bundleDir} (${error.message})`
    );
  }
  ensureDir(bundleDir);
  fs.copyFileSync(exePath, path.join(bundleDir, exeName));

  // pkg cannot embed sharp native directories; ship them beside executable.
  const sharpBase = path.resolve('node_modules', 'sharp');
  const copiedRelease = copyIfExists(
    path.join(sharpBase, 'build', 'Release'),
    path.join(bundleDir, 'sharp', 'build', 'Release')
  );
  const copiedVendor = copyIfExists(
    path.join(sharpBase, 'vendor', 'lib'),
    path.join(bundleDir, 'sharp', 'vendor', 'lib')
  );
  const runtimeRegexByTarget = {
    win: /^sharp-win/i,
    mac: /^sharp-darwin|^sharp-macos/i,
    linux: /^sharp-linux/i,
  };
  const runtimeRegex = runtimeRegexByTarget[target] || /^sharp(-|$)/;
  const copiedImgSharpPackages = copyMatchingDirs(
    path.resolve('node_modules', '@img'),
    runtimeRegex,
    path.join(bundleDir, 'node_modules', '@img')
  );
  const ensuredSharpEntries = copiedImgSharpPackages.map((pkgName) =>
    ensureSharpAddonEntry(path.join(bundleDir, 'node_modules', '@img', pkgName))
  );

  const zip = new AdmZip();
  zip.addLocalFolder(bundleDir);
  zip.writeZip(zipPath);

  console.log(`[package-cli-runtime] bundle: ${bundleDir}`);
  console.log(`[package-cli-runtime] zip: ${zipPath}`);
  console.log(
    `[package-cli-runtime] sharp runtime copied: build/Release=${copiedRelease}, vendor/lib=${copiedVendor}`
  );
  if (copiedImgSharpPackages.length > 0) {
    console.log(
      `[package-cli-runtime] @img packages copied: ${copiedImgSharpPackages.join(', ')}`
    );
    console.log(
      `[package-cli-runtime] sharp.node entry ensured: ${ensuredSharpEntries.join(', ')}`
    );
  } else {
    console.warn(`[package-cli-runtime] no @img runtime package matched target=${target || 'any'}`);
  }
}

main();
