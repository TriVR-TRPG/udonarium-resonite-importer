/**
 * Resonite object type definitions
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ResoniteComponent {
  id?: string;
  type: string;
  fields: Record<string, unknown>;
}

export interface ResoniteObject {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  isActive?: boolean;
  textures: string[];
  components: ResoniteComponent[];
  children: ResoniteObject[];
}
