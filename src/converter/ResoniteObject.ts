/**
 * Resonite object type definitions
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
