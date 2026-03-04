/**
 * compilePlan — Compile ステップ (Phase 3)
 *
 * ZIP → ParseResult → ImportPlan の変換。
 * Resonite 接続不要。dry-run / live import の共通パス。
 *
 * See: docs/redesign-architecture-plan.ja.md Section 4.4 / Phase 3
 */

import * as path from 'path';
import { extractZip } from '../parser/ZipExtractor';
import type { ExtractedFile } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from '../converter/imageAspectRatioMap';
import { buildImageAssetContext } from '../converter/imageAssetContext';
import { buildDryRunImageAssetInfoMap } from '../resonite/dryRunImageAssetInfo';
import { convertObjectsWithImageAssetContext } from '../converter/ObjectConverter';
import { prepareSharedMeshDefinitions, type SharedMeshDefinition } from '../converter/sharedMesh';
import {
  prepareSharedMaterialDefinitions,
  type SharedMaterialDefinition,
} from '../converter/sharedMaterial';
import { collectExternalImageSources } from '../resonite/registerExternalUrls';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import type { ImageBlendMode } from '../config/MappingConfig';
import type { UdonariumObject } from '../domain/UdonariumObject';

import type { ImportConfig, DiagnosticEntry } from './contracts';
import type {
  ImportPlan,
  AssetPlanEntry,
  MeshPlanEntry,
  MaterialPlanEntry,
  SlotPlanEntry,
  ComponentPlanEntry,
  GroupHint,
} from './importPlan';
import type { ResoniteObject } from '../domain/ResoniteObject';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface ParseStats {
  xmlCount: number;
  imageCount: number;
  objectCount: number;
  typeCounts: Record<string, number>;
}

/**
 * Compile 結果。
 *
 * `plan` は JSON シリアライズ可能。dry-run 出力・デバッグ検査に使用する。
 * `_compiled` は Apply ステップが使用する内部ランタイムデータ（バイナリ含む）。
 *
 * Phase 3 では Apply ステップが `_compiled` を直接消費する。
 * Phase 4/5 で Apply が `plan` のみを消費するよう段階的に移行する予定。
 */
export interface CompileResult {
  /** JSON シリアライズ可能な中間表現 */
  plan: ImportPlan;
  /** Apply ステップ用の内部ランタイムデータ */
  _compiled: {
    imageFiles: ExtractedFile[];
    /** ZIP から得たパース済みオブジェクト（Apply 時の再変換で再利用） */
    parsedObjects: UdonariumObject[];
    /** ZIP から得た拡張データ（Apply 時の再変換で再利用） */
    parsedExtensions: ReturnType<typeof parseXmlFiles>['extensions'];
    resoniteObjects: ResoniteObject[];
    sharedMeshDefinitions: SharedMeshDefinition[];
    sharedMaterialDefinitions: SharedMaterialDefinition[];
    imageAspectRatioMap: Map<string, number>;
    imageBlendModeMap: Map<string, ImageBlendMode>;
  };
  parseStats: ParseStats;
  diagnostics: DiagnosticEntry[];
}

// ---------------------------------------------------------------------------
// Internal converters: ResoniteObject → SlotPlanEntry
// ---------------------------------------------------------------------------

function toGroupHint(sourceType?: string): GroupHint | undefined {
  if (!sourceType) return;
  if (sourceType === 'table' || sourceType === 'table-mask') return 'table';
  if (sourceType === 'character') return 'inventory';
  return 'object';
}

function toComponentPlanEntry(component: ResoniteObject['components'][number]): ComponentPlanEntry {
  return {
    type: component.type,
    members: component.fields,
  };
}

function toSlotPlanEntry(obj: ResoniteObject): SlotPlanEntry {
  const entry: SlotPlanEntry = {
    logicalId: obj.id,
    name: obj.name,
    isActive: obj.isActive,
    position: obj.position,
    rotation: obj.rotation,
    components: obj.components.map(toComponentPlanEntry),
    children: obj.children.map(toSlotPlanEntry),
  };

  if (obj.scale) {
    entry.scale = obj.scale;
  }
  if (obj.sourceType) {
    entry.sourceType = obj.sourceType;
  }

  const groupHint = toGroupHint(obj.sourceType);
  if (groupHint) {
    entry.groupHint = groupHint;
  }

  if (obj.sourceType === 'character') {
    const charObj = obj as ResoniteObject & { locationName?: string };
    if (charObj.locationName) {
      entry.locationName = charObj.locationName;
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Internal builders: ImportPlan entries
// ---------------------------------------------------------------------------

function buildAssetPlanEntries(
  imageFiles: ExtractedFile[],
  objects: ReturnType<typeof parseXmlFiles>['objects']
): AssetPlanEntry[] {
  const entries = new Map<string, AssetPlanEntry>();

  for (const imageFile of imageFiles) {
    const id = imageFile.name;
    const ext = path.extname(id).toLowerCase();
    const kind: AssetPlanEntry['kind'] = ext === '.svg' ? 'zip-svg' : 'zip-image';
    entries.set(id, {
      logicalId: id,
      lref: `asset:${id}`,
      kind,
      source: imageFile.name,
    });
  }

  for (const [identifier, source] of collectExternalImageSources(objects)) {
    if (!entries.has(identifier)) {
      const isSvg = /\.svg(?:$|\?)/i.test(source.url);
      const kind: AssetPlanEntry['kind'] = isSvg ? 'external-svg' : 'external-url';
      entries.set(identifier, {
        logicalId: identifier,
        lref: `asset:${identifier}`,
        kind,
        source: source.url,
      });
    }
  }

  return Array.from(entries.values());
}

function buildMeshPlanEntries(defs: SharedMeshDefinition[]): MeshPlanEntry[] {
  return defs.map((def) => ({
    logicalId: def.key,
    lref: `mesh:${def.key}`,
    name: def.name,
    meshType: def.componentType === COMPONENT_TYPES.QUAD_MESH ? 'QuadMesh' : 'BoxMesh',
    size: def.sizeValue,
    ...(def.dualSided ? { dualSided: def.dualSided } : {}),
  }));
}

function buildMaterialPlanEntries(defs: SharedMaterialDefinition[]): MaterialPlanEntry[] {
  return defs.map((def) => ({
    logicalId: def.key,
    lref: `material:${def.key}`,
    name: def.name,
    componentType: def.componentType,
    fields: def.fields,
  }));
}

// ---------------------------------------------------------------------------
// buildImportPlan — public API
// ---------------------------------------------------------------------------

/**
 * ZIP を解析・変換し、ImportPlan を生成する。
 *
 * 副作用なし（Resonite 接続不要）。dry-run と live import の共通 Compile パス。
 *
 * @param config 変換仕様（inputZipPath / transparentBlendMode / enableCharacterCollider 使用）
 * @returns CompileResult
 * @throws ZIP 展開失敗 / パースエラー
 */
export async function buildImportPlan(config: ImportConfig): Promise<CompileResult> {
  const diagnostics: DiagnosticEntry[] = [];

  // -------------------------------------------------------------------------
  // 1. Extract
  // -------------------------------------------------------------------------
  const extractedData = extractZip(config.inputZipPath);

  // -------------------------------------------------------------------------
  // 2. Parse
  // -------------------------------------------------------------------------
  const parseResult = parseXmlFiles(extractedData.xmlFiles);

  for (const err of parseResult.errors) {
    diagnostics.push({
      level: 'warn',
      code: 'PARSE_WARNING',
      message: `${err.file}: ${err.message}`,
    });
  }

  const typeCounts: Record<string, number> = {};
  for (const obj of parseResult.objects) {
    typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
  }

  // -------------------------------------------------------------------------
  // 3. Build image maps (reads actual image binaries via sharp)
  // -------------------------------------------------------------------------
  const imageAspectRatioMap = await buildImageAspectRatioMap(
    extractedData.imageFiles,
    parseResult.objects
  );
  const imageBlendModeMap = await buildImageBlendModeMap(
    extractedData.imageFiles,
    parseResult.objects,
    {
      semiTransparentMode: config.transparentBlendMode,
    }
  );

  // -------------------------------------------------------------------------
  // 4. Build dry-run image asset context (logical IDs = filenames/URLs)
  // -------------------------------------------------------------------------
  const imageAssetInfoMap = buildDryRunImageAssetInfoMap(
    extractedData.imageFiles,
    parseResult.objects
  );
  const imageAssetContext = buildImageAssetContext({
    imageAssetInfoMap,
    imageAspectRatioMap,
    imageBlendModeMap,
  });

  // -------------------------------------------------------------------------
  // 5. Convert objects
  // -------------------------------------------------------------------------
  const resoniteObjects = convertObjectsWithImageAssetContext(
    parseResult.objects,
    imageAssetContext,
    { enableCharacterColliderOnLockedTerrain: config.enableCharacterCollider },
    parseResult.extensions
  );

  // -------------------------------------------------------------------------
  // 6. Prepare shared mesh / material definitions
  //    prepareSharedMeshDefinitions / prepareSharedMaterialDefinitions mutate
  //    resoniteObjects (replace components with mesh-ref:// / material-ref://)
  //    so must run after conversion.
  // -------------------------------------------------------------------------
  const sharedMeshDefinitions = prepareSharedMeshDefinitions(resoniteObjects);
  const sharedMaterialDefinitions = prepareSharedMaterialDefinitions(resoniteObjects);

  // -------------------------------------------------------------------------
  // 7. Build ImportPlan
  // -------------------------------------------------------------------------
  const plan: ImportPlan = {
    configSnapshot: {
      inputZipPath: config.inputZipPath,
      rootScale: config.rootScale,
      transparentBlendMode: config.transparentBlendMode,
      enableCharacterCollider: config.enableCharacterCollider,
      simpleAvatarProtection: config.simpleAvatarProtection,
    },
    assets: buildAssetPlanEntries(extractedData.imageFiles, parseResult.objects),
    meshes: buildMeshPlanEntries(sharedMeshDefinitions),
    materials: buildMaterialPlanEntries(sharedMaterialDefinitions),
    slots: resoniteObjects.map(toSlotPlanEntry),
  };

  return {
    plan,
    _compiled: {
      imageFiles: extractedData.imageFiles,
      parsedObjects: parseResult.objects,
      parsedExtensions: parseResult.extensions,
      resoniteObjects,
      sharedMeshDefinitions,
      sharedMaterialDefinitions,
      imageAspectRatioMap,
      imageBlendModeMap,
    },
    parseStats: {
      xmlCount: extractedData.xmlFiles.length,
      imageCount: extractedData.imageFiles.length,
      objectCount: resoniteObjects.length,
      typeCounts,
    },
    diagnostics,
  };
}
