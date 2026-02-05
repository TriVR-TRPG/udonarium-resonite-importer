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

    // Register disconnect listener once in constructor
    this.client.on('disconnected', () => {
      this._isConnected = false;
    });
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
        reject(error);
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
    scale: Vector3;
  }): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const slot = await this.client.createSlot(
      {
        parent: createReference(options.parentId),
        name: createString(options.name),
        position: createFloat3(options.position),
        scale: createFloat3(options.scale),
        rotation: createFloatQ({ x: 0, y: 0, z: 0, w: 1 }),
        isActive: createBool(true),
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
  async importTexture(path: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const response = await this.client.send({
      $type: 'importTexture2DFile',
      filePath: path,
    });

    return (response as { assetId?: string }).assetId || path;
  }

  /**
   * Import a texture from base64 data
   */
  async importTextureFromData(data: Buffer, name: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    // Convert Buffer to ArrayBuffer (ensure it's a proper ArrayBuffer, not SharedArrayBuffer)
    const arrayBuffer = new ArrayBuffer(data.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(data);

    // Detect image dimensions (simplified - assumes PNG or JPEG)
    const { width, height } = this.getImageDimensions(data);

    // Note: messageId is added by client.send internally
    const message = {
      $type: 'importTexture2DRawData' as const,
      width,
      height,
      colorProfile: 'sRGB',
      messageId: '', // Will be overwritten by client.send
    };

    const response = await this.client.send(message, arrayBuffer);

    return (response as { assetId?: string }).assetId || name;
  }

  /**
   * Add a component to a slot
   */
  async addComponent(options: {
    slotId: string;
    componentType: string;
    fields: Record<string, unknown>;
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    await this.client.createComponent(options.slotId, {
      componentType: options.componentType,
      members: options.fields as Record<string, never>,
    });
  }

  /**
   * Get the root slot
   */
  async getRootSlot(): Promise<ClientSlot | undefined> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    return this.client.getSlot('Root');
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

  private getImageDimensions(data: Buffer): { width: number; height: number } {
    // PNG signature check
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
      // PNG: width and height are at offset 16 and 20 (IHDR chunk)
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      return { width, height };
    }

    // JPEG signature check
    if (data[0] === 0xff && data[1] === 0xd8) {
      // JPEG: need to find SOF marker
      let offset = 2;
      while (offset < data.length) {
        if (data[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = data[offset + 1];
        // SOF0, SOF1, SOF2 markers
        if (marker >= 0xc0 && marker <= 0xc2) {
          const height = data.readUInt16BE(offset + 5);
          const width = data.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = data.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }

    // Default fallback
    return { width: 256, height: 256 };
  }
}
