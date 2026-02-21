import { ObjectType } from './UdonariumObject';

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

type BaseResoniteObject = {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  scale?: Vector3;
  sourceType?: Exclude<ObjectType, 'character'>;
  isActive: boolean;
  components: ResoniteComponent[];
  children: ResoniteObject[];
};

export type CharacterResoniteObject = Omit<BaseResoniteObject, 'sourceType'> & {
  sourceType: 'character';
  locationName?: string;
};

export type ResoniteObject = BaseResoniteObject | CharacterResoniteObject;
