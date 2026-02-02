/**
 * WebSocket client for ResoniteLink communication
 */

import WebSocket from 'ws';
import {
  ResoniteLinkMessage,
  AddSlotMessage,
  UpdateSlotMessage,
  ImportTextureMessage,
  AddComponentMessage,
} from '../converter/ResoniteObject';
import { RETRY_CONFIG, DEFAULT_RESONITE_LINK } from '../config/MappingConfig';

export interface ResoniteLinkConfig {
  host: string;
  port: number;
}

export class ResoniteLinkClient {
  private ws: WebSocket | null = null;
  private config: ResoniteLinkConfig;
  private messageId = 0;
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();

  constructor(config: Partial<ResoniteLinkConfig> = {}) {
    this.config = {
      host: config.host || DEFAULT_RESONITE_LINK.host,
      port: config.port || DEFAULT_RESONITE_LINK.port,
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
          delay = Math.min(
            delay * RETRY_CONFIG.backoffMultiplier,
            RETRY_CONFIG.maxDelay
          );
        }
      }
    }

    throw new Error(
      `Failed to connect to ResoniteLink after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`
    );
  }

  private tryConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://${this.config.host}:${this.config.port}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this.ws = null;
      });
    });
  }

  /**
   * Disconnect from ResoniteLink
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a message and wait for response
   */
  private async sendMessage(message: ResoniteLinkMessage): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ResoniteLink');
    }

    const id = `msg_${++this.messageId}`;
    const messageWithId = { ...message, id };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.ws!.send(JSON.stringify(messageWithId), (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Timeout for response
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as { id?: string; [key: string]: unknown };

      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        resolve(message);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  /**
   * Add a slot (create object) in Resonite
   */
  async addSlot(message: Omit<AddSlotMessage, 'type'>): Promise<string> {
    const response = await this.sendMessage({
      type: 'addSlot',
      ...message,
    } as AddSlotMessage);

    const slotId = (response as { slotId?: string }).slotId;
    return slotId !== undefined ? slotId : (message as { id: string }).id;
  }

  /**
   * Update an existing slot
   */
  async updateSlot(message: Omit<UpdateSlotMessage, 'type'>): Promise<void> {
    await this.sendMessage({
      type: 'updateSlot',
      ...message,
    } as UpdateSlotMessage);
  }

  /**
   * Import a texture from file path
   */
  async importTexture(path: string): Promise<string> {
    const response = await this.sendMessage({
      type: 'importTexture',
      path,
    } as ImportTextureMessage);

    return (response as { textureId?: string }).textureId || path;
  }

  /**
   * Import a texture from base64 data
   */
  async importTextureFromData(
    data: Buffer,
    name: string
  ): Promise<string> {
    const base64 = data.toString('base64');
    const response = await this.sendMessage({
      type: 'importTexture',
      name,
      data: base64,
    } as ResoniteLinkMessage);

    return (response as { textureId?: string }).textureId || name;
  }

  /**
   * Add a component to a slot
   */
  async addComponent(
    message: Omit<AddComponentMessage, 'type'>
  ): Promise<void> {
    await this.sendMessage({
      type: 'addComponent',
      ...message,
    } as AddComponentMessage);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
