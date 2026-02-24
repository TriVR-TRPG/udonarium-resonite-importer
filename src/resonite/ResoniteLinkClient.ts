/**
 * WebSocket client for ResoniteLink communication
 * Uses @eth0fox/tsrl library
 */

import type {
  AddComponentMessage,
  AddSlotMessage,
  AnyFieldValue,
  ClientMessage,
  ResoniteLink,
} from '@eth0fox/tsrl';
import { WebSocket as NodeWebSocket } from 'ws';
import { RETRY_CONFIG, getResoniteLinkHost } from '../config/MappingConfig';

export interface ResoniteLinkConfig {
  host: string;
  port: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SlotTransform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface ResoniteLinkSessionData {
  resoniteVersion?: string;
  resoniteLinkVersion?: string;
  uniqueSessionId?: string;
}

interface SlotLike {
  id: string;
  children?: Array<{ id: string }> | null;
}

type ComponentMembers = Record<string, Record<string, unknown>>;
type RawFieldValue<T> = { value: T };
type RawReferenceValue = { $type: 'reference'; targetId: string };

interface RawAddSlotMessage {
  $type: 'addSlot';
  data: {
    id: string;
    parent: RawReferenceValue;
    name: RawFieldValue<string>;
    position: RawFieldValue<Vector3>;
    scale: RawFieldValue<Vector3>;
    rotation: RawFieldValue<Quaternion>;
    isActive: RawFieldValue<boolean>;
    isPersistent: RawFieldValue<boolean>;
    tag: RawFieldValue<string>;
    orderOffset: RawFieldValue<number>;
  };
}

interface RawAddComponentMessage {
  $type: 'addComponent';
  containerSlotId: string;
  data: {
    id: string;
    componentType: string;
    members: Record<string, unknown>;
  };
}

type RawClientMessage = RawAddSlotMessage | RawAddComponentMessage;
type TsrlRuntimeModule = {
  ResoniteLink: { connect: (url: string, webSocketCtor: unknown) => Promise<ResoniteLink> };
};

const createReference = (targetId: string) => ({ $type: 'reference' as const, targetId });
const createField = <T>(value: T) => ({ value });
const toTsrlMembers = (members: Record<string, unknown>): Record<string, AnyFieldValue> =>
  members as Record<string, AnyFieldValue>;

// Keep native dynamic import at runtime even when this file is compiled to CommonJS.
// TypeScript rewrites `import()` to `require()` under `module: commonjs`, which breaks ESM-only packages.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importModule = new Function('specifier', 'return import(specifier);') as (
  specifier: string
) => Promise<unknown>;

async function loadTsrlRuntimeModule(): Promise<TsrlRuntimeModule> {
  try {
    const module = await importModule('@eth0fox/tsrl');
    return module as TsrlRuntimeModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('A dynamic import callback was not specified')) {
      const module = await import('@eth0fox/tsrl');
      return module as TsrlRuntimeModule;
    }
    throw error;
  }
}

function ensureGlobalWebSocket(): void {
  const globalWithWebSocket = globalThis as Record<string, unknown>;
  if (!globalWithWebSocket.WebSocket) {
    globalWithWebSocket.WebSocket = NodeWebSocket as unknown;
  }
}

function toTsrlClientMessage(message: RawClientMessage): ClientMessage {
  switch (message.$type) {
    case 'addSlot': {
      const converted: AddSlotMessage = {
        $type: 'addSlot',
        data: {
          id: message.data.id,
          parent: message.data.parent,
          name: message.data.name,
          position: message.data.position,
          scale: message.data.scale,
          rotation: message.data.rotation,
          isActive: message.data.isActive,
          isPersistent: message.data.isPersistent,
          tag: message.data.tag,
          orderOffset: message.data.orderOffset,
        },
      };
      return converted;
    }
    case 'addComponent': {
      const converted: AddComponentMessage = {
        $type: 'addComponent',
        containerSlotId: message.containerSlotId,
        data: {
          id: message.data.id,
          componentType: message.data.componentType,
          members: toTsrlMembers(message.data.members),
        },
      };
      return converted;
    }
  }
}

export class ResoniteLinkClient {
  private static runtimeModuleLoader?: () => Promise<TsrlRuntimeModule>;
  private link?: ResoniteLink;
  private config: ResoniteLinkConfig;
  private _isConnected = false;

  constructor(config: { host?: string; port: number }) {
    this.config = {
      host: config.host || getResoniteLinkHost(),
      port: config.port,
    };
  }

  /**
   * Connect to ResoniteLink with retry logic
   */
  async connect(): Promise<void> {
    let lastError: Error | null = null;
    let delay = RETRY_CONFIG.initialDelay;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        await this.tryConnect();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < RETRY_CONFIG.maxAttempts) {
          await this.sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelay);
        }
      }
    }

    throw new Error(
      `Failed to connect to ResoniteLink after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`
    );
  }

  static setRuntimeModuleLoaderForTests(loader?: () => Promise<TsrlRuntimeModule>): void {
    if (!loader) {
      delete this.runtimeModuleLoader;
      return;
    }
    this.runtimeModuleLoader = loader;
  }

  private static async resolveRuntimeModule(): Promise<TsrlRuntimeModule> {
    if (this.runtimeModuleLoader) {
      return this.runtimeModuleLoader();
    }
    return loadTsrlRuntimeModule();
  }

  private async tryConnect(): Promise<void> {
    ensureGlobalWebSocket();
    const { ResoniteLink } = await ResoniteLinkClient.resolveRuntimeModule();
    const url = `ws://${this.config.host}:${this.config.port}`;
    this.link = await ResoniteLink.connect(url, NodeWebSocket as never);
    this._isConnected = true;
  }

  /**
   * Disconnect from ResoniteLink
   */
  disconnect(): void {
    this.link?.socket.close();
    this._isConnected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    const socket = this.link?.socket;
    return this._isConnected && !!socket && socket.readyState === socket.OPEN;
  }

  /**
   * Get the underlying tsrl link instance
   */
  getClient() {
    return this.link;
  }

  private getConnectedLink(): ResoniteLink {
    if (!this.isConnected() || !this.link) {
      throw new Error('Not connected to ResoniteLink');
    }
    return this.link;
  }

  private callRaw(message: RawClientMessage): Promise<unknown> {
    const link = this.getConnectedLink();
    return link.call(toTsrlClientMessage(message));
  }

  /**
   * Get session information from ResoniteLink.
   */
  async getSessionData(): Promise<ResoniteLinkSessionData> {
    const link = this.getConnectedLink();
    const sessionData = await link.requestSessionData();

    return {
      resoniteVersion: sessionData.resoniteVersion,
      resoniteLinkVersion: sessionData.resoniteLinkVersion,
      uniqueSessionId: sessionData.uniqueSessionId,
    };
  }

  /**
   * Add a slot (create object) in Resonite
   */
  async addSlot(options: {
    id: string;
    parentId: string;
    name: string;
    position: Vector3;
    rotation?: Quaternion;
    scale?: Vector3;
    isActive?: boolean;
    tag?: string;
  }): Promise<string> {
    const scale = options.scale ?? { x: 1, y: 1, z: 1 };
    const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
    const message: RawAddSlotMessage = {
      $type: 'addSlot',
      data: {
        id: options.id,
        parent: createReference(options.parentId),
        name: createField(options.name),
        position: createField(options.position),
        scale: createField(scale),
        rotation: createField(rotation),
        isActive: createField(options.isActive ?? true),
        isPersistent: createField(true),
        tag: createField(options.tag ?? ''),
        orderOffset: createField(0),
      },
    };
    await this.callRaw(message);

    return options.id;
  }

  /**
   * Update an existing slot
   */
  async updateSlot(options: {
    id: string;
    position?: Vector3;
    rotation?: Vector3;
    scale?: Vector3;
    tag?: string;
  }): Promise<void> {
    const link = this.getConnectedLink();

    const data: Record<string, unknown> = {};
    if (options.position) {
      data.position = createField(options.position);
    }
    if (options.rotation) {
      data.rotation = createField(this.eulerToQuaternion(options.rotation));
    }
    if (options.scale) {
      data.scale = createField(options.scale);
    }
    if (typeof options.tag === 'string') {
      data.tag = createField(options.tag);
    }

    if (Object.keys(data).length === 0) {
      return;
    }

    await link.slotUpdate(options.id, data as never);
  }

  /**
   * Import a texture from file path
   */
  async importTexture(filePath: string): Promise<string> {
    const link = this.getConnectedLink();
    return link.importTexture2DFile(filePath);
  }

  /**
   * Import raw RGBA pixel data as a texture
   */
  async importTextureFromRawData(
    data: ArrayBuffer,
    width: number,
    height: number,
    colorProfile: string = 'sRGB'
  ): Promise<string> {
    const link = this.getConnectedLink();
    return link.importTexture2DRawData(width, height, data, colorProfile as never);
  }

  /**
   * Add a component to a slot
   */
  async addComponent(options: {
    id?: string;
    slotId: string;
    componentType: string;
    fields: Record<string, unknown>;
  }): Promise<string> {
    const link = this.getConnectedLink();
    if (options.id) {
      const message: RawAddComponentMessage = {
        $type: 'addComponent',
        containerSlotId: options.slotId,
        data: {
          id: options.id,
          componentType: options.componentType,
          members: options.fields,
        },
      };
      await this.callRaw(message);
      return options.id;
    }

    return link.componentAdd(options.slotId, options.componentType, options.fields as never);
  }

  /**
   * Update members on an existing component
   */
  async updateComponent(options: {
    componentId: string;
    fields: Record<string, unknown>;
  }): Promise<void> {
    const link = this.getConnectedLink();
    await link.componentUpdate(options.componentId, options.fields as never);
  }

  /**
   * Get component members from Resonite.
   * Returns the raw members object keyed by member name.
   */
  async getComponentMembers(componentId: string): Promise<ComponentMembers> {
    const link = this.getConnectedLink();
    const component = await link.componentGet(componentId);
    return component.members as unknown as ComponentMembers;
  }

  async updateListFields(componentId: string, listFields: Record<string, unknown>): Promise<void> {
    await this.updateComponent({ componentId, fields: listFields });

    const members = await this.getComponentMembers(componentId);

    const resolvedFields: Record<string, unknown> = {};
    for (const [fieldName, listValue] of Object.entries(listFields)) {
      const list = listValue as { $type: string; elements: Array<Record<string, unknown>> };
      const serverList = members[fieldName] as {
        $type: string;
        elements: Array<{ id: string; $type: string }>;
      };

      if (!serverList?.elements?.length) continue;

      const resolvedElements = list.elements.map((element: Record<string, unknown>, i: number) => ({
        ...element,
        id: serverList.elements[i].id,
      }));

      resolvedFields[fieldName] = {
        $type: list.$type,
        elements: resolvedElements,
      };
    }

    if (Object.keys(resolvedFields).length > 0) {
      await this.updateComponent({ componentId, fields: resolvedFields });
    }
  }

  async addComponents(
    slotId: string,
    components: Array<{ id?: string; type: string; fields: Record<string, unknown> }>
  ): Promise<string[]> {
    const componentIds: string[] = [];
    for (const component of components) {
      const id = await this.addComponent({
        ...(component.id != null ? { id: component.id } : {}),
        slotId,
        componentType: component.type,
        fields: component.fields,
      });
      componentIds.push(id);
    }
    return componentIds;
  }

  getRootSlot(): Promise<SlotLike> {
    const link = this.getConnectedLink();
    return link.slotGet('Root', false, 0) as unknown as Promise<SlotLike>;
  }

  async getSlotChildIds(slotId: string): Promise<string[]> {
    const link = this.getConnectedLink();
    const slot = (await link.slotGet(slotId, false, 1)) as unknown as SlotLike | null;

    if (!slot) {
      return [];
    }

    return (slot.children ?? []).map((child) => child.id);
  }

  async removeSlot(slotId: string): Promise<void> {
    const link = this.getConnectedLink();
    await link.slotRemove(slotId);
  }

  async getSlotTag(slotId: string) {
    const slotData = await this.getSlotData(slotId);
    const tag = slotData?.tag?.value;
    if (typeof tag === 'string') {
      return tag;
    }
    return;
  }

  async getSlotTransform(slotId: string) {
    const slotData = await this.getSlotData(slotId);
    if (!slotData) {
      return;
    }

    const position = slotData.position?.value;
    const rotation = slotData.rotation?.value;
    const scale = slotData.scale?.value;

    if (!this.isVector3(position) || !this.isQuaternion(rotation) || !this.isVector3(scale)) {
      return;
    }

    return { position, rotation, scale };
  }

  async captureTransformAndRemoveRootChildrenByTag(
    tag: string
  ): Promise<{ removedCount: number; transform?: SlotTransform }> {
    if (!tag) {
      return { removedCount: 0 };
    }

    const childIds = await this.getSlotChildIds('Root');
    let removedCount = 0;
    let capturedTransform: SlotTransform | null = null;

    for (const childId of childIds) {
      const childTag = await this.getSlotTag(childId);
      if (childTag !== tag) {
        continue;
      }

      if (!capturedTransform) {
        capturedTransform = (await this.getSlotTransform(childId)) ?? null;
      }

      await this.removeSlot(childId);
      removedCount += 1;
    }

    return {
      removedCount,
      ...(capturedTransform != null ? { transform: capturedTransform } : {}),
    };
  }

  async removeRootChildrenByTag(tag: string): Promise<number> {
    const result = await this.captureTransformAndRemoveRootChildrenByTag(tag);
    return result.removedCount;
  }

  private async getSlotData(slotId: string): Promise<{
    tag?: { value?: unknown };
    position?: { value?: unknown };
    rotation?: { value?: unknown };
    scale?: { value?: unknown };
  } | null> {
    const link = this.getConnectedLink();
    try {
      return (await link.slotGet(slotId, false, 0)) as unknown as {
        tag?: { value?: unknown };
        position?: { value?: unknown };
        rotation?: { value?: unknown };
        scale?: { value?: unknown };
      };
    } catch {
      return null;
    }
  }

  private isVector3(value: unknown): value is Vector3 {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.x === 'number' &&
      typeof candidate.y === 'number' &&
      typeof candidate.z === 'number'
    );
  }

  private isQuaternion(value: unknown): value is Quaternion {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.x === 'number' &&
      typeof candidate.y === 'number' &&
      typeof candidate.z === 'number' &&
      typeof candidate.w === 'number'
    );
  }

  async reparentSlot(slotId: string, newParentId: string): Promise<void> {
    const link = this.getConnectedLink();
    await link.slotUpdate(slotId, { parent: createReference(newParentId) } as never);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private eulerToQuaternion(euler: Vector3): Quaternion {
    const x = (euler.x * Math.PI) / 180 / 2;
    const y = (euler.y * Math.PI) / 180 / 2;
    const z = (euler.z * Math.PI) / 180 / 2;

    const sx = Math.sin(x);
    const sy = Math.sin(y);
    const sz = Math.sin(z);
    const cx = Math.cos(x);
    const cy = Math.cos(y);
    const cz = Math.cos(z);

    return {
      // Match Resonite's Elements.Core.floatQ.Euler implementation.
      x: cy * sx * cz + sy * cx * sz,
      y: sy * cx * cz - cy * sx * sz,
      z: cy * cx * sz - sy * sx * cz,
      w: cy * cx * cz + sy * sx * sz,
    };
  }
}
