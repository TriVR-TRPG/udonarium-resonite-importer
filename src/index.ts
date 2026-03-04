#!/usr/bin/env node
/**
 * Udonarium Resonite Importer
 * Import Udonarium save data into Resonite via ResoniteLink
 *
 * CLI Adapter (Phase 1)
 * CLIOptions → ImportConfig + ImportOptions → runImport()
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
import { convertObjectsWithImageAssetContext } from './converter/ObjectConverter';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from './converter/imageAspectRatioMap';
import { buildImageAssetContext } from './converter/imageAssetContext';
import { buildDryRunImageAssetInfoMap } from './resonite/dryRunImageAssetInfo';
import {
  IMPORT_GROUP_SCALE,
  getResoniteLinkPort,
  getResoniteLinkHost,
} from './config/MappingConfig';
import { t, setLocale, Locale } from './i18n';
import { APP_VERSION } from './version';

import { runImport } from './application/importRunner';
import type { ImportConfig, ImportOptions, ProgressEvent } from './application/contracts';

interface CLIOptions {
  input: string;
  port?: string;
  host?: string;
  dryRun: boolean;
  verbose: boolean;
  lang?: string;
  rootScale: string;
  rootGrabbable: boolean;
  simpleAvatarProtection: boolean;
  transparentBlendMode: string;
  enableCharacterCollider: boolean;
  disableCharacterCollider: boolean;
}

const NO_PARSED_OBJECTS_ERROR = 'No supported objects were found in the ZIP file.';

function parseLocaleFromArgv(argv: string[]) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lang' || arg === '-l') {
      const value = argv[i + 1];
      if (value === 'en' || value === 'ja') {
        return value;
      }
    }

    if (arg.startsWith('--lang=')) {
      const value = arg.slice('--lang='.length);
      if (value === 'en' || value === 'ja') {
        return value;
      }
    }
  }
  return;
}

const localeFromArgs = parseLocaleFromArgv(process.argv.slice(2));
if (localeFromArgs) {
  setLocale(localeFromArgs);
}

const program = new Command();

program
  .name('udonarium-resonite-importer')
  .description(t('cli.description'))
  .version(APP_VERSION, '-V, --version', t('cli.help.version'))
  .requiredOption('-i, --input <path>', t('cli.help.input'))
  .option('-p, --port <number>', t('cli.help.port'))
  .option('-H, --host <string>', t('cli.help.host'))
  .option('--root-scale <number>', 'Import root scale (default: 1)', String(IMPORT_GROUP_SCALE))
  .option('--root-grabbable', 'Add Grabbable to import root', false)
  .option('--no-simple-avatar-protection', 'Disable SimpleAvatarProtection components')
  .option(
    '--transparent-blend-mode <mode>',
    'Blend mode for semi-transparent images (Cutout or Alpha)',
    'Cutout'
  )
  .option('--enable-character-collider', t('cli.help.enableCharacterColliderOnLockedTerrain'), true)
  .option(
    '--disable-character-collider',
    t('cli.help.disableCharacterColliderOnLockedTerrain'),
    false
  )
  .option('-d, --dry-run', t('cli.help.dryRun'), false)
  .option('-v, --verbose', t('cli.help.verbose'), false)
  .option('-l, --lang <locale>', t('cli.help.lang'))
  .helpOption('-h, --help', t('cli.help.help'))
  .action(run);

// ---------------------------------------------------------------------------
// CLI Adapter: CLIOptions → ImportConfig + ImportOptions
// ---------------------------------------------------------------------------

function buildImportConfig(options: CLIOptions, port: number, host: string): ImportConfig {
  const rootScale = Number.parseFloat(options.rootScale);
  const transparentBlendMode = (() => {
    const mode = options.transparentBlendMode.trim().toLowerCase();
    if (mode === 'alpha') return 'Alpha' as const;
    return 'Cutout' as const;
  })();
  return {
    inputZipPath: path.resolve(options.input),
    resonite: { host, port },
    rootScale,
    rootGrabbable: options.rootGrabbable,
    simpleAvatarProtection: options.simpleAvatarProtection,
    transparentBlendMode,
    enableCharacterCollider: options.enableCharacterCollider && !options.disableCharacterCollider,
  };
}

function buildImportOptions(options: CLIOptions): ImportOptions {
  return {
    dryRun: options.dryRun,
    verbose: options.verbose,
  };
}

// ---------------------------------------------------------------------------
// ProgressEvent → CLI スピナー表示
// ---------------------------------------------------------------------------

function makeProgressHandler(
  verbose: boolean,
  onPhaseChange: (phase: ProgressEvent['phase']) => void
): (event: ProgressEvent) => void {
  let lastPhase: ProgressEvent['phase'] | null = null;
  return (event: ProgressEvent) => {
    if (event.phase !== lastPhase) {
      lastPhase = event.phase;
      onPhaseChange(event.phase);
    }
    if (event.level === 'warn') {
      console.warn(chalk.yellow(`  ⚠ ${event.message}`));
    } else if (event.level === 'error') {
      console.error(chalk.red(`  ✖ ${event.message}`));
    } else if (verbose && event.message) {
      // verbose モードでは info メッセージも表示
    }
  };
}

// ---------------------------------------------------------------------------
// メイン実行
// ---------------------------------------------------------------------------

async function run(options: CLIOptions): Promise<void> {
  if (options.lang) {
    setLocale(options.lang as Locale);
  }

  console.log(chalk.bold.cyan(`\n${t('app.title')} ${t('app.version', { version: APP_VERSION })}`));
  console.log(chalk.cyan('='.repeat(40)));
  console.log();

  // --- バリデーション ---

  let port: number | null = null;
  if (options.port) {
    port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red('Invalid port number. Must be between 1 and 65535.'));
      process.exit(1);
    }
  } else {
    port = getResoniteLinkPort() ?? null;
  }

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

  const host = options.host || getResoniteLinkHost();

  const rootScale = Number.parseFloat(options.rootScale);
  if (!Number.isFinite(rootScale) || rootScale <= 0) {
    console.error(chalk.red('Invalid root scale. Must be a positive number.'));
    process.exit(1);
  }

  const semiTransparentImageBlendModeArg = options.transparentBlendMode.trim();
  if (
    semiTransparentImageBlendModeArg.toLowerCase() !== 'alpha' &&
    semiTransparentImageBlendModeArg.toLowerCase() !== 'cutout'
  ) {
    console.error(chalk.red('Invalid semi-transparent image blend mode. Use "Cutout" or "Alpha".'));
    process.exit(1);
  }

  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(t('cli.error.fileNotFound', { path: inputPath })));
    process.exit(1);
  }

  // --- dry-run パス（Phase 2 で AnalyzeUseCase に移行予定）---

  if (options.dryRun) {
    const semiTransparentMode =
      semiTransparentImageBlendModeArg.toLowerCase() === 'alpha' ? 'Alpha' : ('Cutout' as const);
    const enableCharacterColliderOnLockedTerrain =
      options.enableCharacterCollider && !options.disableCharacterCollider;

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

    const parseSpinner = ora(`[2/4] ${t('cli.parsing')}`).start();
    const parseResult = parseXmlFiles(extractedData.xmlFiles);

    if (parseResult.errors.length > 0 && options.verbose) {
      for (const err of parseResult.errors) {
        console.warn(chalk.yellow(`  Warning: ${err.file} - ${err.message}`));
      }
    }

    if (parseResult.objects.length === 0) {
      parseSpinner.fail(`[2/4] ${t('cli.parsed', { count: 0 })}`);
      console.error(chalk.red(NO_PARSED_OBJECTS_ERROR));
      process.exit(1);
    }

    parseSpinner.succeed(`[2/4] ${t('cli.parsed', { count: parseResult.objects.length })}`);

    if (options.verbose) {
      const typeCounts = new Map<string, number>();
      for (const obj of parseResult.objects) {
        typeCounts.set(obj.type, (typeCounts.get(obj.type) || 0) + 1);
      }
      for (const [type, count] of typeCounts) {
        const typeName = t(`objectTypes.${type}`);
        console.log(chalk.gray(`      - ${typeName}: ${count}`));
      }
    }

    const imageAspectRatioMap = await buildImageAspectRatioMap(
      extractedData.imageFiles,
      parseResult.objects
    );
    const imageBlendModeMap = await buildImageBlendModeMap(
      extractedData.imageFiles,
      parseResult.objects,
      { semiTransparentMode }
    );
    const imageAssetInfoMap = buildDryRunImageAssetInfoMap(
      extractedData.imageFiles,
      parseResult.objects
    );
    const imageAssetContext = buildImageAssetContext({
      imageAssetInfoMap,
      imageAspectRatioMap,
      imageBlendModeMap,
    });
    const resoniteObjects = convertObjectsWithImageAssetContext(
      parseResult.objects,
      imageAssetContext,
      { enableCharacterColliderOnLockedTerrain },
      parseResult.extensions
    );

    console.log();
    console.log(chalk.yellow(t('cli.dryRunMode')));
    console.log();
    console.log(chalk.bold(t('cli.summary')));
    console.log(`  ${t('cli.objectsToImport', { count: resoniteObjects.length })}`);
    console.log(`  ${t('cli.imagesToImport', { count: extractedData.imageFiles.length })}`);
    console.log();

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

  // --- ライブインポートパス ---

  const config = buildImportConfig(options, port as number, host);
  const importOptions = buildImportOptions(options);

  // In dev mode (ts-node), dump parsed objects to JSON for debugging
  // (dry-run では上で処理済み; ライブインポートは runner 実行前にパースしないためスキップ)

  // スピナー管理
  // TypeScript CFA で let 変数をクロージャ内で書き換えると never に narrowing される問題を
  // ref オブジェクトパターンで回避する
  type Spinner = {
    isSpinning: boolean;
    succeed(text?: string): Spinner;
    fail(text?: string): Spinner;
  };
  const spinnerLabels: Partial<Record<ProgressEvent['phase'], string>> = {
    extract: `[1/4] ${t('cli.extracting')}`,
    parse: `[2/4] ${t('cli.parsing')}`,
    connect: `[3/4] ${t('cli.connecting', { host: config.resonite.host, port: config.resonite.port })}`,
    apply: `[4/4] ${t('cli.importing')}`,
  };
  const spinnerRef = { current: null as Spinner | null };
  let currentPhase: ProgressEvent['phase'] | null = null;

  const onProgress = makeProgressHandler(options.verbose, (phase) => {
    // 前フェーズのスピナーを完了
    if (spinnerRef.current?.isSpinning) {
      spinnerRef.current.succeed();
    }

    // cleanup/apply/finalize は同じスピナー [4/4]
    const spinnerPhase = phase === 'cleanup' || phase === 'finalize' ? 'apply' : phase;
    const label = spinnerLabels[spinnerPhase];

    if (
      label &&
      (spinnerPhase !== 'apply' ||
        currentPhase === null ||
        (currentPhase !== 'cleanup' && currentPhase !== 'apply'))
    ) {
      spinnerRef.current = ora(label).start() as unknown as Spinner;
    }
    currentPhase = phase;
  });

  try {
    const report = await runImport(config, importOptions, onProgress);

    // finalize 完了 → apply スピナーを閉じる
    const successSpinner = spinnerRef.current;
    if (successSpinner && successSpinner.isSpinning) {
      const { images, objects } = report.summary;
      successSpinner.succeed(
        `[4/4] ${t('cli.importComplete', {
          images: `${images.success}/${images.total}`,
          objects: `${objects.success}/${objects.total}`,
        })}`
      );
    }

    // 詳細警告を verbose 時に表示
    if (options.verbose) {
      for (const diag of report.diagnostics) {
        if (diag.level === 'warn') {
          console.warn(chalk.yellow(`  Warning: ${diag.message}`));
        }
      }
    }

    console.log();
    console.log(chalk.green.bold(t('cli.success')));
    console.log(chalk.green(t('cli.checkResonite')));
    console.log();
  } catch (error) {
    const failSpinner = spinnerRef.current;
    if (failSpinner && failSpinner.isSpinning) {
      failSpinner.fail();
    }
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}

program.parse();
