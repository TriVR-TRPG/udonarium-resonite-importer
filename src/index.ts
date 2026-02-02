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
import { t, setLocale, Locale } from './i18n';

const VERSION = '1.0.0';

interface CLIOptions {
  input: string;
  port: number;
  host: string;
  scale: number;
  dryRun: boolean;
  verbose: boolean;
  lang?: string;
}

const program = new Command();

program
  .name('udonarium-resonite-importer')
  .description(t('cli.description'))
  .version(VERSION)
  .requiredOption('-i, --input <path>', 'Input ZIP file path')
  .option('-p, --port <number>', 'ResoniteLink port', String(DEFAULT_RESONITE_LINK.port))
  .option('-H, --host <string>', 'ResoniteLink host', DEFAULT_RESONITE_LINK.host)
  .option('-s, --scale <number>', 'Scale factor', String(SCALE_FACTOR))
  .option('-d, --dry-run', 'Analyze only, do not connect to Resonite', false)
  .option('-v, --verbose', 'Verbose output', false)
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

  // Convert to Resonite objects
  const resoniteObjects = convertObjects(parseResult.objects);

  // Dry run - stop here
  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow(t('cli.dryRunMode')));
    console.log();
    console.log(chalk.bold(t('cli.summary')));
    console.log(`  ${t('cli.objectsToImport', { count: resoniteObjects.length })}`);
    console.log(`  ${t('cli.imagesToImport', { count: extractedData.imageFiles.length })}`);
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
    `[3/4] ${t('cli.connecting', { host: options.host, port: options.port })}`
  ).start();

  const client = new ResoniteLinkClient({
    host: options.host,
    port: Number(options.port),
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
        importSpinner.text = `[4/4] ${t('cli.importingImages', { current, total })}`;
      }
    );

    const failedImages = imageResults.filter((r) => !r.success);
    if (failedImages.length > 0 && options.verbose) {
      for (const img of failedImages) {
        console.warn(chalk.yellow(`  Warning: Failed to import ${img.identifier}: ${img.error}`));
      }
    }

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
  }

  console.log();
  console.log(chalk.green.bold(t('cli.success')));
  console.log(chalk.green(t('cli.checkResonite')));
  console.log();
}

program.parse();
