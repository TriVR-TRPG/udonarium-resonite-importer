/**
 * Helper for building Resonite slots from Udonarium objects
 */

import { ResoniteObject, Vector3 } from '../converter/ResoniteObject';
import { ResoniteLinkClient } from './ResoniteLinkClient';

export interface SlotBuildResult {
  slotId: string;
  success: boolean;
  error?: string;
}

export class SlotBuilder {
  private client: ResoniteLinkClient;
  private rootSlotId: string;

  constructor(client: ResoniteLinkClient, rootSlotId = 'Root') {
    this.client = client;
    this.rootSlotId = rootSlotId;
  }

  /**
   * Build a slot from a Resonite object
   */
  async buildSlot(obj: ResoniteObject, parentId?: string): Promise<SlotBuildResult> {
    try {
      const slotId = await this.client.addSlot({
        id: obj.id,
        parentId: parentId || this.rootSlotId,
        name: obj.name,
        position: obj.position,
        scale: obj.scale,
      });

      // Set rotation if not zero
      if (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) {
        await this.client.updateSlot({
          id: slotId,
          rotation: obj.rotation,
        });
      }

      // Build children recursively
      for (const child of obj.children) {
        await this.buildSlot(child, slotId);
      }

      return { slotId, success: true };
    } catch (error) {
      return {
        slotId: obj.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build multiple slots
   */
  async buildSlots(
    objects: ResoniteObject[],
    onProgress?: (current: number, total: number) => void
  ): Promise<SlotBuildResult[]> {
    const results: SlotBuildResult[] = [];
    const total = objects.length;

    for (let i = 0; i < objects.length; i++) {
      const result = await this.buildSlot(objects[i]);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  /**
   * Create a group slot to contain imported objects
   */
  async createImportGroup(name: string): Promise<string> {
    const groupId = `udonarium_import_${Date.now()}`;
    const position: Vector3 = { x: 0, y: 0, z: 0 };
    const scale: Vector3 = { x: 1, y: 1, z: 1 };

    await this.client.addSlot({
      id: groupId,
      parentId: this.rootSlotId,
      name,
      position,
      scale,
    });

    this.rootSlotId = groupId;
    return groupId;
  }
}
