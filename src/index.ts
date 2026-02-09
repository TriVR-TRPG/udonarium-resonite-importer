#!/usr/bin/env node
/**
 * Udonarium Resonite Importer
 * Import Udonarium save data into Resonite via ResoniteLink
 */

import * as dotenv from 'dotenv';
// Load .env file before other imports that may use environment variables
dotenv.config();

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

import { extractZip } from './parser/ZipExtractor';
import { parseXmlFiles } from './parser/XmlParser';
import { convertObjects, convertObjectsWithTextureMap } from './converter/ObjectConverter';
import { ResoniteLinkClient } from './resonite/ResoniteLinkClient';
import { SlotBuilder } from './resonite/SlotBuilder';
import { AssetImporter } from './resonite/AssetImporter';
import { registerExternalUrls } from './resonite/registerExternalUrls';
import { SCALE_FACTOR, getResoniteLinkPort, getResoniteLinkHost } from './config/MappingConfig';
import { t, setLocale, Locale } from './i18n';

const VERSION = '1.0.0';

interface CLIOptions {
  input: string;
  port?: string;
  host?: string;
  scale: number;
  dryRun: boolean;
  verbose: boolean;
  dumpJson: boolean;
  lang?: string;
}

const program = new Command();

program
  .name('udonarium-resonite-importer')
  .description(t('cli.description'))
  .version(VERSION)
  .requiredOption('-i, --input <path>', 'Input ZIP file path')
  .option('-p, --port <number>', 'ResoniteLink port (required, or set RESONITELINK_PORT env var)')
  .option(
    '-H, --host <string>',
    'ResoniteLink host (default: localhost, or set RESONITELINK_HOST env var)'
  )
  .option('-s, --scale <number>', 'Scale factor', String(SCALE_FACTOR))
  .option('-d, --dry-run', 'Analyze only, do not connect to Resonite', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--dump-json', 'Dump parsed UdonariumObjects to JSON file (dry-run only)', false)
  .option('-l, --lang <locale>', 'Language (en, ja)', undefined)
  .action(run);

async function run(options: CLIOptions): Promise<void> {
  // Set locale if specified
  if (options.lang) {
    setLocale(options.lang as Locale);
  }

  console.log(chalk.bold.cyan(`\n${t('app.title')} ${t('app.version', { version: VERSION })}`));
  console.log(chalk.cyan('='.repeat(40)));
  console.log();

  // Resolve port from CLI option or environment variable
  let port: number | undefined;
  if (options.port) {
    port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red('Invalid port number. Must be between 1 and 65535.'));
      process.exit(1);
    }
  } else {
    port = getResoniteLinkPort();
  }

  // Port is required unless dry-run mode
  if (!port && !options.dryRun) {
    console.error(
      chalk.red(
        'ResoniteLink port is required.\n' +
          'Specify via CLI: -p <port>\n' +
          'Or set environment variable: RESONITELINK_PORT=<port>\n' +
          'Or create a .env file with: RESONITELINK_PORT=<port>'
      )
    );
    process.exit(1);
  }

  // Resolve host from CLI option or environment variable
  const host = options.host || getResoniteLinkHost();

  // Validate input file
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(t('cli.error.fileNotFound', { path: inputPath })));
    process.exit(1);
  }

  // Step 1: Extract ZIP
  const extractSpinner = ora(`[1/4] ${t('cli.extracting')}`).start();
  let extractedData;
  try {
    extractedData = extractZip(inputPath);
    extractSpinner.succeed(
      `[1/4] ${t('cli.extracted', { xml: extractedData.xmlFiles.length, images: extractedData.imageFiles.length })}`
    );
  } catch (error) {
    extractSpinner.fail(`[1/4] ${t('cli.error.extractFailed')}`);
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }

  // Step 2: Parse objects
  const parseSpinner = ora(`[2/4] ${t('cli.parsing')}`).start();
  const parseResult = parseXmlFiles(extractedData.xmlFiles);

  if (parseResult.errors.length > 0 && options.verbose) {
    for (const err of parseResult.errors) {
      console.warn(chalk.yellow(`  Warning: ${err.file} - ${err.message}`));
    }
  }

  // Count by type
  const typeCounts = new Map<string, number>();
  for (const obj of parseResult.objects) {
    typeCounts.set(obj.type, (typeCounts.get(obj.type) || 0) + 1);
  }

  parseSpinner.succeed(`[2/4] ${t('cli.parsed', { count: parseResult.objects.length })}`);

  if (options.verbose) {
    for (const [type, count] of typeCounts) {
      const typeName = t(`objectTypes.${type}`);
      console.log(chalk.gray(`      - ${typeName}: ${count}`));
    }
  }

  // Dry run - stop here
  if (options.dryRun) {
    // Convert to Resonite objects (dry-run only)
    const resoniteObjects = convertObjects(parseResult.objects);

    console.log();
    console.log(chalk.yellow(t('cli.dryRunMode')));
    console.log();
    console.log(chalk.bold(t('cli.summary')));
    console.log(`  ${t('cli.objectsToImport', { count: resoniteObjects.length })}`);
    console.log(`  ${t('cli.imagesToImport', { count: extractedData.imageFiles.length })}`);
    console.log();

    if (options.dumpJson) {
      const replacer = (_key: string, value: unknown): unknown =>
        value instanceof Map ? Object.fromEntries(value as Map<string, unknown>) : value;
      const jsonContent = JSON.stringify(parseResult.objects, replacer, 2);
      const jsonPath = inputPath.replace(/\.zip$/i, '') + '.parsed.json';
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
      console.log(chalk.bold(`Parsed Udonarium Objects → ${jsonPath}`));
      console.log();
    }

    if (options.verbose) {
      console.log(chalk.bold('Converted Resonite Objects:'));
      for (const obj of resoniteObjects) {
        console.log(
          `  - ${obj.name} (${obj.id}) at (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`
        );
      }
    }
    return;
  }

  // Step 3: Connect to ResoniteLink
  // At this point, port is guaranteed to be defined (validated above, not dry-run)
  const resolvedPort = port as number;
  const connectSpinner = ora(`[3/4] ${t('cli.connecting', { host, port: resolvedPort })}`).start();

  const client = new ResoniteLinkClient({
    host,
    port: resolvedPort,
  });

  try {
    await client.connect();
    connectSpinner.succeed(`[3/4] ${t('cli.connected')}`);
  } catch (error) {
    connectSpinner.fail(`[3/4] ${t('cli.error.connectFailed')}`);
    console.error(chalk.red(`\n${t('cli.error.ensureResonite')}`));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }

  // Step 4: Import
  const importSpinner = ora(`[4/4] ${t('cli.importing')}`).start();

  const assetImporter = new AssetImporter(client);

  // Register external URL references (e.g., ./assets/images/tex.jpg → https://udonarium.app/assets/images/tex.jpg)
  registerExternalUrls(parseResult.objects, assetImporter);

  try {
    const slotBuilder = new SlotBuilder(client);

    // Create import group
    const groupName = `Udonarium Import - ${path.basename(inputPath, '.zip')}`;
    const groupId = await slotBuilder.createImportGroup(groupName);

    // Import images and move texture slots into the import group
    const rootChildIdsBefore = await client.getSlotChildIds('Root');

    let importedImages = 0;
    const imageResults = await assetImporter.importImages(
      extractedData.imageFiles,
      (current, total) => {
        importedImages = current;
        importSpinner.text = `[4/4] ${t('cli.importingImages', { current, total })}`;
      }
    );

    const failedImages = imageResults.filter((r) => !r.success);
    if (failedImages.length > 0 && options.verbose) {
      for (const img of failedImages) {
        console.warn(chalk.yellow(`  Warning: Failed to import ${img.identifier}: ${img.error}`));
      }
    }

    // Move newly created texture slots into the import group
    const rootChildIdsAfter = await client.getSlotChildIds('Root');
    const beforeSet = new Set(rootChildIdsBefore);
    const newSlotIds = rootChildIdsAfter.filter((id) => !beforeSet.has(id));
    for (const slotId of newSlotIds) {
      try {
        await client.reparentSlot(slotId, groupId);
      } catch {
        // Non-critical: texture slot stays at root
      }
    }

    // Build objects after texture import so StaticTexture2D.URL can be set directly from imported URLs.
    const resoniteObjects = convertObjectsWithTextureMap(
      parseResult.objects,
      assetImporter.getImportedTextures()
    );

    // Build slots
    let builtSlots = 0;
    const slotResults = await slotBuilder.buildSlots(resoniteObjects, (current, total) => {
      builtSlots = current;
      importSpinner.text = `[4/4] ${t('cli.importingObjects', { current, total })}`;
    });

    const failedSlots = slotResults.filter((r) => !r.success);
    if (failedSlots.length > 0 && options.verbose) {
      for (const slot of failedSlots) {
        console.warn(chalk.yellow(`  Warning: Failed to create ${slot.slotId}: ${slot.error}`));
      }
    }

    const successImages = importedImages - failedImages.length;
    const successObjects = builtSlots - failedSlots.length;
    importSpinner.succeed(
      `[4/4] ${t('cli.importComplete', { images: `${successImages}/${importedImages}`, objects: `${successObjects}/${builtSlots}` })}`
    );

    client.disconnect();
  } catch (error) {
    importSpinner.fail(`[4/4] ${t('cli.error.importFailed')}`);
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    client.disconnect();
    process.exit(1);
  } finally {
    assetImporter.cleanup();
  }

  console.log();
  console.log(chalk.green.bold(t('cli.success')));
  console.log(chalk.green(t('cli.checkResonite')));
  console.log();
}

program.parse();
