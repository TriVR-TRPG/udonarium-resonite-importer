/**
 * Slot tree export logic — reusable module
 *
 * Exports slot hierarchy from a running Resonite session via ResoniteLink.
 * Extracted from scripts/export-slot-tree.ts for use in round-trip tests.
 */

import { ResoniteLinkClient } from './ResoniteLinkClient';

// ── Types ───────────────────────────────────────────────────────────

export interface ExportedComponent {
  id: string;
  componentType: string;
  members: Record<string, unknown>;
}

export interface ExportedSlot {
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

export interface ExportOptions {
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
  currentDepth: number
): Promise<ExportedSlot> {
  // Fetch detailed component data
  const components: ExportedComponent[] = [];
  if (raw.components) {
    for (const comp of raw.components) {
      const detail = await fetchComponentMembers(link, comp.id);
      if (detail) {
        components.push(convertComponent(detail, options));
      } else {
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
      const childSlot = await convertSlotTree(link, child, options, currentDepth + 1);
      children.push(childSlot);
    }
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

// ── Public API ──────────────────────────────────────────────────────

/**
 * Export a slot tree from Resonite.
 *
 * @param client Connected ResoniteLinkClient
 * @param slotId The slot ID to export
 * @param options Export options (maxDepth, includeInternal)
 * @returns The exported slot tree, or null if the slot was not found
 */
export async function exportSlotTree(
  client: ResoniteLinkClient,
  slotId: string,
  options: ExportOptions = { maxDepth: 20, includeInternal: false }
): Promise<ExportedSlot | null> {
  const link = getConnectedLink(client);
  const rawTree = await fetchSlotTree(link, slotId, options.maxDepth);
  if (!rawTree) {
    return null;
  }
  return convertSlotTree(link, rawTree, options, 0);
}
