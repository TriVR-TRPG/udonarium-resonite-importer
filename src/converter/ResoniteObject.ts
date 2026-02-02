/**
 * Resonite object type definitions for ResoniteLink
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ResoniteComponent {
  type: string;
  fields: Record<string, unknown>;
}

export interface ResoniteObject {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  textures: string[];
  components: ResoniteComponent[];
  children: ResoniteObject[];
}

export interface ResoniteLinkMessage {
  type: string;
  [key: string]: unknown;
}

export interface AddSlotMessage extends ResoniteLinkMessage {
  type: 'addSlot';
  id: string;
  parentId: string;
  name: string;
  position: Vector3;
  scale: Vector3;
}

export interface UpdateSlotMessage extends ResoniteLinkMessage {
  type: 'updateSlot';
  id: string;
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
}

export interface ImportTextureMessage extends ResoniteLinkMessage {
  type: 'importTexture';
  path: string;
}

export interface AddComponentMessage extends ResoniteLinkMessage {
  type: 'addComponent';
  slotId: string;
  componentType: string;
  fields: Record<string, unknown>;
}
