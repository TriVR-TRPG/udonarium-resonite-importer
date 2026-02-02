#!/usr/bin/env node
/**
 * Udonarium Resonite Importer
 * Import Udonarium save data into Resonite via ResoniteLink
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

import { extractZip } from './parser/ZipExtractor';
import { parseXmlFiles } from './parser/XmlParser';
import { convertObjects } from './converter/ObjectConverter';
import { ResoniteLinkClient } from './resonite/ResoniteLinkClient';
import { SlotBuilder } from './resonite/SlotBuilder';
import { AssetImporter } from './resonite/AssetImporter';
import { DEFAULT_RESONITE_LINK, SCALE_FACTOR } from './config/MappingConfig';

const VERSION = '1.0.0';

interface CLIOptions {
  input: string;
  port: number;
  host: string;
  scale: number;
  dryRun: boolean;
  verbose: boolean;
}

const program = new Command();

program
  .name('udonarium-resonite-importer')
  .description('Import Udonarium save data into Resonite via ResoniteLink')
  .version(VERSION)
  .requiredOption('-i, --input <path>', 'Input ZIP file path')
  .option('-p, --port <number>', 'ResoniteLink port', String(DEFAULT_RESONITE_LINK.port))
  .option('-h, --host <string>', 'ResoniteLink host', DEFAULT_RESONITE_LINK.host)
  .option('-s, --scale <number>', 'Scale factor', String(SCALE_FACTOR))
  .option('-d, --dry-run', 'Analyze only, do not connect to Resonite', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(run);

async function run(options: CLIOptions): Promise<void> {
  console.log(chalk.bold.cyan(`\nUdonarium Resonite Importer v${VERSION}`));
  console.log(chalk.cyan('='.repeat(40)));
  console.log();

  // Validate input file
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`Error: File not found: ${inputPath}`));
    process.exit(1);
  }

  // Step 1: Extract ZIP
  const extractSpinner = ora('[1/4] Extracting ZIP file...').start();
  let extractedData;
  try {
    extractedData = extractZip(inputPath);
    extractSpinner.succeed(
      `[1/4] ZIP extracted - XML: ${extractedData.xmlFiles.length}, Images: ${extractedData.imageFiles.length}`
    );
  } catch (error) {
    extractSpinner.fail('[1/4] Failed to extract ZIP');
    console.error(
      chalk.red(error instanceof Error ? error.message : 'Unknown error')
    );
    process.exit(1);
  }

  // Step 2: Parse objects
  const parseSpinner = ora('[2/4] Parsing objects...').start();
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

  parseSpinner.succeed(`[2/4] Parsed ${parseResult.objects.length} objects`);

  if (options.verbose) {
    for (const [type, count] of typeCounts) {
      console.log(chalk.gray(`      - ${type}: ${count}`));
    }
  }

  // Convert to Resonite objects
  const resoniteObjects = convertObjects(parseResult.objects);

  // Dry run - stop here
  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow('Dry run mode - not connecting to Resonite'));
    console.log();
    console.log(chalk.bold('Summary:'));
    console.log(`  Objects to import: ${resoniteObjects.length}`);
    console.log(`  Images to import: ${extractedData.imageFiles.length}`);
    console.log();

    if (options.verbose) {
      console.log(chalk.bold('Objects:'));
      for (const obj of resoniteObjects) {
        console.log(
          `  - ${obj.name} (${obj.id}) at (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`
        );
      }
    }
    return;
  }

  // Step 3: Connect to ResoniteLink
  const connectSpinner = ora(
    `[3/4] Connecting to ResoniteLink (${options.host}:${options.port})...`
  ).start();

  const client = new ResoniteLinkClient({
    host: options.host,
    port: Number(options.port),
  });

  try {
    await client.connect();
    connectSpinner.succeed('[3/4] Connected to ResoniteLink');
  } catch (error) {
    connectSpinner.fail('[3/4] Failed to connect to ResoniteLink');
    console.error(chalk.red('\nMake sure Resonite is running with ResoniteLink enabled.'));
    console.error(
      chalk.red(error instanceof Error ? error.message : 'Unknown error')
    );
    process.exit(1);
  }

  // Step 4: Import
  const importSpinner = ora('[4/4] Importing to Resonite...').start();

  try {
    const assetImporter = new AssetImporter(client);
    const slotBuilder = new SlotBuilder(client);

    // Create import group
    const groupName = `Udonarium Import - ${path.basename(inputPath, '.zip')}`;
    await slotBuilder.createImportGroup(groupName);

    // Import images
    let importedImages = 0;
    const imageResults = await assetImporter.importImages(
      extractedData.imageFiles,
      (current, total) => {
        importedImages = current;
        importSpinner.text = `[4/4] Importing images... ${current}/${total}`;
      }
    );

    const failedImages = imageResults.filter((r) => !r.success);
    if (failedImages.length > 0 && options.verbose) {
      for (const img of failedImages) {
        console.warn(
          chalk.yellow(`  Warning: Failed to import ${img.identifier}: ${img.error}`)
        );
      }
    }

    // Build slots
    let builtSlots = 0;
    const slotResults = await slotBuilder.buildSlots(
      resoniteObjects,
      (current, total) => {
        builtSlots = current;
        importSpinner.text = `[4/4] Creating objects... ${current}/${total}`;
      }
    );

    const failedSlots = slotResults.filter((r) => !r.success);
    if (failedSlots.length > 0 && options.verbose) {
      for (const slot of failedSlots) {
        console.warn(
          chalk.yellow(`  Warning: Failed to create ${slot.slotId}: ${slot.error}`)
        );
      }
    }

    importSpinner.succeed(
      `[4/4] Import complete - Images: ${importedImages - failedImages.length}/${importedImages}, Objects: ${builtSlots - failedSlots.length}/${builtSlots}`
    );

    client.disconnect();
  } catch (error) {
    importSpinner.fail('[4/4] Import failed');
    console.error(
      chalk.red(error instanceof Error ? error.message : 'Unknown error')
    );
    client.disconnect();
    process.exit(1);
  }

  console.log();
  console.log(chalk.green.bold('Import completed successfully!'));
  console.log(chalk.green('Check Resonite to see the imported objects.'));
  console.log();
}

program.parse();
