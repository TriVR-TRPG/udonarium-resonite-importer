/**
 * Resonite Slot Tree Export Script
 *
 * Exports the slot hierarchy from a running Resonite session via ResoniteLink.
 * Use this as a development reference to understand slot structures
 * and write corresponding TypeScript code in this project.
 *
 * Prerequisites:
 * 1. Resonite is running with ResoniteLink enabled
 * 2. Set RESONITELINK_PORT environment variable or create .env file
 *
 * Usage:
 *   npx ts-node scripts/export-slot-tree.ts [options]
 *
 * Options:
 *   --slot-id <id>     Export a specific slot by ID (skip interactive selection)
 *   --depth <n>        Maximum depth to traverse (default: 20)
 *   --output <path>    Output file path (default: stdout)
 *   --include-internal Include internal fields (persistent, UpdateOrder, etc.)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as readline from 'readline';
import { ResoniteLinkClient } from '../src/resonite/ResoniteLinkClient';
import { getResoniteLinkPort, getResoniteLinkHost } from '../src/config/MappingConfig';

// ── Types ───────────────────────────────────────────────────────────

interface ExportedComponent {
  id: string;
  componentType: string;
  members: Record<string, unknown>;
}

interface ExportedSlot {
  id: string;
  name: string;
  tag: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  isActive: boolean;
  orderOffset: number;
  components: ExportedComponent[];
  children: ExportedSlot[];
}

/** Raw slot data returned by slotGet */
interface RawSlotData {
  name?: { value?: string };
  tag?: { value?: string };
  position?: { value?: { x: number; y: number; z: number } };
  rotation?: { value?: { x: number; y: number; z: number; w: number } };
  scale?: { value?: { x: number; y: number; z: number } };
  isActive?: { value?: boolean };
  orderOffset?: { value?: number };
  components?: Array<{ id: string; componentType?: string }>;
  children?: Array<RawSlotData & { id: string }> | null;
  id: string;
}

interface RawComponentData {
  id: string;
  componentType: string;
  members: Record<string, RawMemberValue>;
}

interface RawMemberValue {
  $type: string;
  value?: unknown;
  id?: string;
  targetId?: string | null;
  targetType?: string;
  enumType?: string;
  elements?: unknown[];
  [key: string]: unknown;
}

interface ExportOptions {
  maxDepth: number;
  includeInternal: boolean;
}

// Fields that are common to all components and usually not interesting for reference
const INTERNAL_FIELDS = new Set(['persistent', 'UpdateOrder', 'Enabled']);

// ── Core export logic ───────────────────────────────────────────────

function getConnectedLink(client: ResoniteLinkClient): {
  call: (message: Record<string, unknown>) => Promise<unknown>;
} {
  const link = client.getClient();
  if (!link) {
    throw new Error('ResoniteLink client is not connected');
  }
  return {
    call: (message: Record<string, unknown>) =>
      (link as unknown as { call: (m: Record<string, unknown>) => Promise<unknown> }).call(message),
  };
}

/**
 * Fetch a slot and its children recursively using slotGet with depth.
 */
async function fetchSlotTree(
  link: ReturnType<typeof getConnectedLink>,
  slotId: string,
  depth: number
): Promise<RawSlotData | null> {
  const response = (await link.call({
    $type: 'getSlot',
    slotId,
    depth,
    includeComponentData: true,
  })) as { success: boolean; data?: RawSlotData; errorInfo?: string };

  if (!response.success || !response.data) {
    return null;
  }
  return response.data;
}

/**
 * Fetch component member details via componentGet.
 */
async function fetchComponentMembers(
  link: ReturnType<typeof getConnectedLink>,
  componentId: string
): Promise<RawComponentData | null> {
  try {
    const response = (await link.call({
      $type: 'getComponent',
      componentId,
    })) as { success: boolean; data?: RawComponentData };

    if (!response.success || !response.data) {
      return null;
    }
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Strip internal Resonite IDs from member values for cleaner output.
 * Keeps $type, value, targetId, targetType, enumType, elements — removes `id` fields.
 */
function cleanMemberValue(value: RawMemberValue): unknown {
  if (value.$type === 'list') {
    return {
      $type: 'list',
      elements: (value.elements ?? []).map((el) => {
        if (el && typeof el === 'object' && '$type' in (el as Record<string, unknown>)) {
          return cleanMemberValue(el as RawMemberValue);
        }
        return el;
      }),
    };
  }

  if (value.$type === 'reference') {
    const cleaned: Record<string, unknown> = {
      $type: 'reference',
      targetId: value.targetId ?? null,
    };
    if (value.targetType) {
      cleaned.targetType = value.targetType;
    }
    return cleaned;
  }

  if (value.$type === 'enum') {
    return {
      $type: 'enum',
      value: value.value,
      enumType: value.enumType,
    };
  }

  // Simple value types: just keep $type and value
  return {
    $type: value.$type,
    value: value.value,
  };
}

/**
 * Convert raw component data to exported format.
 */
function convertComponent(raw: RawComponentData, options: ExportOptions): ExportedComponent {
  const members: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(raw.members)) {
    if (!options.includeInternal && INTERNAL_FIELDS.has(name)) {
      continue;
    }
    members[name] = cleanMemberValue(value);
  }
  return {
    id: raw.id,
    componentType: raw.componentType,
    members,
  };
}

/**
 * Recursively convert a raw slot tree to exported format,
 * fetching component details along the way.
 */
async function convertSlotTree(
  link: ReturnType<typeof getConnectedLink>,
  raw: RawSlotData,
  options: ExportOptions,
  currentDepth: number,
  progress: { slotsProcessed: number; componentsProcessed: number }
): Promise<ExportedSlot> {
  progress.slotsProcessed++;

  // Fetch detailed component data
  const components: ExportedComponent[] = [];
  if (raw.components) {
    for (const comp of raw.components) {
      progress.componentsProcessed++;
      const detail = await fetchComponentMembers(link, comp.id);
      if (detail) {
        components.push(convertComponent(detail, options));
      } else {
        // Fallback: include component type without members
        components.push({
          id: comp.id,
          componentType: comp.componentType ?? 'unknown',
          members: {},
        });
      }
    }
  }

  // Process children
  const children: ExportedSlot[] = [];
  if (raw.children && currentDepth < options.maxDepth) {
    for (const child of raw.children) {
      const childSlot = await convertSlotTree(link, child, options, currentDepth + 1, progress);
      children.push(childSlot);
    }
  }

  if (progress.slotsProcessed % 10 === 0) {
    process.stderr.write(
      `\r  Processing... ${progress.slotsProcessed} slots, ${progress.componentsProcessed} components`
    );
  }

  return {
    id: raw.id,
    name: raw.name?.value ?? '',
    tag: raw.tag?.value ?? '',
    position: raw.position?.value ?? { x: 0, y: 0, z: 0 },
    rotation: raw.rotation?.value ?? { x: 0, y: 0, z: 0, w: 1 },
    scale: raw.scale?.value ?? { x: 1, y: 1, z: 1 },
    isActive: raw.isActive?.value ?? true,
    orderOffset: raw.orderOffset?.value ?? 0,
    components,
    children,
  };
}

// ── Interactive slot selection ──────────────────────────────────────

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

interface SlotInfo {
  id: string;
  name: string;
}

async function getChildSlotInfos(
  link: ReturnType<typeof getConnectedLink>,
  parentId: string
): Promise<SlotInfo[]> {
  const parent = await fetchSlotTree(link, parentId, 1);
  if (!parent?.children) {
    return [];
  }
  return parent.children.map((child) => ({
    id: child.id,
    name: child.name?.value ?? '(unnamed)',
  }));
}

async function interactiveSlotSelection(
  link: ReturnType<typeof getConnectedLink>
): Promise<string> {
  const rl = createReadlineInterface();

  try {
    let currentParentId = 'Root';
    let currentPath = 'Root';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const children = await getChildSlotInfos(link, currentParentId);

      if (children.length === 0) {
        process.stderr.write(`\n  "${currentPath}" has no children.\n`);
        process.stderr.write(`  Exporting this slot.\n\n`);
        return currentParentId;
      }

      process.stderr.write(`\n  Current: ${currentPath}\n`);
      process.stderr.write(`  Children:\n`);
      for (let i = 0; i < children.length; i++) {
        process.stderr.write(`    [${i + 1}] ${children[i].name}\n`);
      }
      process.stderr.write(`    [0] Export current slot ("${currentPath}")\n\n`);

      const answer = await ask(rl, '  Select (number): ');
      const num = parseInt(answer, 10);

      if (num === 0) {
        return currentParentId;
      }

      if (num >= 1 && num <= children.length) {
        const selected = children[num - 1];
        currentParentId = selected.id;
        currentPath = `${currentPath}/${selected.name}`;
      } else {
        process.stderr.write(`  Invalid selection. Try again.\n`);
      }
    }
  } finally {
    rl.close();
  }
}

// ── CLI argument parsing ────────────────────────────────────────────

interface CliArgs {
  slotId?: string;
  maxDepth: number;
  outputPath?: string;
  includeInternal: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    maxDepth: 20,
    includeInternal: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--slot-id':
        args.slotId = argv[++i];
        break;
      case '--depth':
        args.maxDepth = parseInt(argv[++i], 10);
        break;
      case '--output':
      case '-o':
        args.outputPath = argv[++i];
        break;
      case '--include-internal':
        args.includeInternal = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${argv[i]}\n`);
        printUsage();
        process.exit(1);
    }
  }

  return args;
}

function printUsage(): void {
  process.stderr.write(`
Usage: npx ts-node scripts/export-slot-tree.ts [options]

Options:
  --slot-id <id>       Export a specific slot by ID (skip interactive selection)
  --depth <n>          Maximum depth to traverse (default: 20)
  --output, -o <path>  Output file path (default: stdout)
  --include-internal   Include internal fields (persistent, UpdateOrder, Enabled)
  --help, -h           Show this help message

Environment:
  RESONITELINK_PORT    ResoniteLink port (required)
  RESONITELINK_HOST    ResoniteLink host (default: localhost)

`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  process.stderr.write('Resonite Slot Tree Exporter\n');
  process.stderr.write('==========================\n\n');

  const port = getResoniteLinkPort();
  const host = getResoniteLinkHost();

  if (!port) {
    process.stderr.write('[error] RESONITELINK_PORT is required\n\n');
    process.stderr.write('Set via environment variable:\n');
    process.stderr.write('  RESONITELINK_PORT=<port> npx ts-node scripts/export-slot-tree.ts\n\n');
    process.stderr.write('Or create a .env file with:\n');
    process.stderr.write('  RESONITELINK_PORT=<port>\n');
    process.exit(1);
  }

  const client = new ResoniteLinkClient({ host, port });

  process.stderr.write(`Connecting to ResoniteLink at ${host}:${port}...\n`);

  try {
    await client.connect();
    process.stderr.write('  [ok] Connected!\n');
  } catch (error) {
    process.stderr.write('\n[error] Failed to connect to ResoniteLink\n');
    process.stderr.write(`Error: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }

  const link = getConnectedLink(client);

  try {
    // Select slot
    const targetSlotId = args.slotId ?? (await interactiveSlotSelection(link));

    process.stderr.write(`\n  Exporting slot: ${targetSlotId}\n`);
    process.stderr.write(`  Max depth: ${args.maxDepth}\n\n`);

    // Fetch slot tree
    const rawTree = await fetchSlotTree(link, targetSlotId, args.maxDepth);
    if (!rawTree) {
      process.stderr.write(`[error] Slot not found: ${targetSlotId}\n`);
      process.exit(1);
      return; // unreachable, but helps TypeScript narrow the type
    }

    // Convert with component detail fetching
    const progress = { slotsProcessed: 0, componentsProcessed: 0 };
    const exported = await convertSlotTree(
      link,
      rawTree,
      { maxDepth: args.maxDepth, includeInternal: args.includeInternal },
      0,
      progress
    );

    process.stderr.write(
      `\r  Done! ${progress.slotsProcessed} slots, ${progress.componentsProcessed} components\n\n`
    );

    // Output
    const json = JSON.stringify(exported, null, 2) + '\n';

    if (args.outputPath) {
      fs.writeFileSync(args.outputPath, json);
      process.stderr.write(`  Saved to: ${args.outputPath}\n`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    client.disconnect();
    process.stderr.write('Disconnected.\n');
  }
}

main().catch((error) => {
  process.stderr.write(`\n[error] ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
