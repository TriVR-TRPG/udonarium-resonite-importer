/**
 * WebSocket client for ResoniteLink communication
 * Uses resonitelink.js library (local submodule)
 */

import {
  Client,
  ClientSlot,
  createString,
  createReference,
  createFloat3,
  createFloatQ,
  createBool,
  createLong,
} from '../../lib/resonitelink.js/dist';
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

export class ResoniteLinkClient {
  private client: Client;
  private config: ResoniteLinkConfig;
  private _isConnected = false;

  constructor(config: { host?: string; port: number }) {
    this.config = {
      host: config.host || getResoniteLinkHost(),
      port: config.port,
    };
    this.client = new Client({
      host: this.config.host,
      port: this.config.port,
    });
    this.assertClientContract(this.client);

    // Register disconnect listener once in constructor
    this.client.on('disconnected', () => {
      this._isConnected = false;
    });
  }

  /**
   * Runtime compatibility check against resonitelink.js API.
   * This helps detect breaking library updates even when ambient type declarations exist.
   */
  private assertClientContract(value: unknown): void {
    const requiredMethods = [
      'on',
      'off',
      'connect',
      'disconnect',
      'send',
      'createSlot',
      'getSlot',
      'createComponent',
      'getComponent',
    ] as const;

    if (!value || typeof value !== 'object') {
      throw new Error('Invalid resonitelink client instance');
    }

    const candidate = value as Record<string, unknown>;
    for (const method of requiredMethods) {
      if (typeof candidate[method] !== 'function') {
        throw new Error(`Incompatible resonitelink client API: missing method "${method}"`);
      }
    }
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

  private tryConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, 5000);

      const onConnected = () => {
        cleanup();
        this._isConnected = true;
        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.client.off('connected', onConnected);
      };

      this.client.on('connected', onConnected);

      try {
        this.client.connect();
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Disconnect from ResoniteLink
   */
  disconnect(): void {
    this.client.disconnect();
    this._isConnected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._isConnected && this.client.isConnected;
  }

  /**
   * Get the underlying resonitelink.js Client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Add a slot (create object) in Resonite
   */
  async addSlot(options: {
    id: string;
    parentId: string;
    name: string;
    position: Vector3;
    scale?: Vector3;
    isActive?: boolean;
  }): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const scale = options.scale ?? { x: 1, y: 1, z: 1 };
    const slot = await this.client.createSlot(
      {
        parent: createReference(options.parentId),
        name: createString(options.name),
        position: createFloat3(options.position),
        scale: createFloat3(scale),
        rotation: createFloatQ({ x: 0, y: 0, z: 0, w: 1 }),
        isActive: createBool(options.isActive ?? true),
        isPersistent: createBool(true),
        tag: createString(''),
        orderOffset: createLong(0),
      },
      options.id
    );

    return slot?.id ?? options.id;
  }

  /**
   * Update an existing slot
   */
  async updateSlot(options: {
    id: string;
    position?: Vector3;
    rotation?: Vector3;
    scale?: Vector3;
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const slot = await this.client.getSlot(options.id);
    if (!slot) {
      throw new Error(`Slot not found: ${options.id}`);
    }

    if (options.position) {
      await slot.setPosition(options.position);
    }

    if (options.rotation) {
      // Convert euler to quaternion (simplified)
      const rotation = this.eulerToQuaternion(options.rotation);
      await slot.setRotation(rotation);
    }

    if (options.scale) {
      await slot.setScale(options.scale);
    }
  }

  /**
   * Import a texture from file path
   */
  async importTexture(filePath: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const response = await this.client.send({
      $type: 'importTexture2DFile',
      filePath,
    });

    const result = response as { assetURL?: string; success?: boolean; errorInfo?: string };
    if (!result.success) {
      throw new Error(result.errorInfo || 'Failed to import texture');
    }

    return result.assetURL || filePath;
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
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const response = await this.client.send(
      {
        $type: 'importTexture2DRawData' as const,
        width,
        height,
        colorProfile,
        messageId: '',
      },
      data
    );

    const result = response as { assetURL?: string; success?: boolean; errorInfo?: string };
    if (!result.success) {
      throw new Error(result.errorInfo || 'Failed to import raw texture data');
    }

    return result.assetURL || `texture_${width}x${height}`;
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
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const component = await this.client.createComponent(
      options.slotId,
      {
        componentType: options.componentType,
        members: options.fields as Record<string, never>,
      },
      options.id
    );

    if (!component) {
      throw new Error(`Failed to add component: ${options.componentType}`);
    }

    return component.id;
  }

  /**
   * Update members on an existing component
   */
  async updateComponent(options: {
    componentId: string;
    fields: Record<string, unknown>;
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const response = (await this.client.send({
      $type: 'updateComponent' as const,
      data: {
        id: options.componentId,
        members: options.fields as Record<string, never>,
      },
    })) as { success?: boolean; errorInfo?: string };

    if (!response.success) {
      throw new Error(response.errorInfo || 'Failed to update component');
    }
  }

  /**
   * Get component members from Resonite.
   * Returns the raw members object keyed by member name.
   */
  async getComponentMembers(componentId: string): Promise<Record<string, Record<string, unknown>>> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const component = await this.client.getComponent(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    return component.members as unknown as Record<string, Record<string, unknown>>;
  }

  /**
   * Update SyncList fields on a component using the 2-step protocol:
   *  1. Send list with elements (id omitted) to add new elements (targetId ignored)
   *  2. Fetch component to get server-assigned element IDs
   *  3. Send list with elements including id to set targetId
   */
  async updateListFields(componentId: string, listFields: Record<string, unknown>): Promise<void> {
    // Step 1: Add elements (targetId will be null)
    await this.updateComponent({ componentId, fields: listFields });

    // Step 2: Fetch server-assigned element IDs
    const members = await this.getComponentMembers(componentId);

    // Step 3: For each list field, re-send with server-assigned element IDs
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

  /**
   * Add multiple components to a slot
   */
  async addComponents(
    slotId: string,
    components: Array<{ id?: string; type: string; fields: Record<string, unknown> }>
  ): Promise<string[]> {
    const componentIds: string[] = [];
    for (const component of components) {
      const id = await this.addComponent({
        id: component.id,
        slotId,
        componentType: component.type,
        fields: component.fields,
      });
      componentIds.push(id);
    }
    return componentIds;
  }

  /**
   * Get the root slot
   */
  getRootSlot(): Promise<ClientSlot | undefined> {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Not connected to ResoniteLink'));
    }

    return this.client.getSlot('Root');
  }

  /**
   * Get child slot IDs of a given slot
   */
  async getSlotChildIds(slotId: string): Promise<string[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const slot = await this.client.getSlot(slotId, 1);
    if (!slot) {
      return [];
    }

    return slot.childrens.map((child) => child.id);
  }

  /**
   * Move a slot to a new parent
   */
  async reparentSlot(slotId: string, newParentId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const slot = await this.client.getSlot(slotId);
    if (!slot) {
      throw new Error(`Slot not found: ${slotId}`);
    }

    await slot.setParent(newParentId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private eulerToQuaternion(euler: Vector3): Quaternion {
    // Convert degrees to radians
    const x = (euler.x * Math.PI) / 180 / 2;
    const y = (euler.y * Math.PI) / 180 / 2;
    const z = (euler.z * Math.PI) / 180 / 2;

    const cx = Math.cos(x);
    const sx = Math.sin(x);
    const cy = Math.cos(y);
    const sy = Math.sin(y);
    const cz = Math.cos(z);
    const sz = Math.sin(z);

    return {
      x: sx * cy * cz - cx * sy * sz,
      y: cx * sy * cz + sx * cy * sz,
      z: cx * cy * sz - sx * sy * cz,
      w: cx * cy * cz + sx * sy * sz,
    };
  }
}
