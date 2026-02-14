/**
 * Udonarium object type definitions
 */

export type ObjectType =
  | 'character'
  | 'card'
  | 'card-stack'
  | 'terrain'
  | 'table'
  | 'table-mask'
  | 'text-note';

export interface ImageRef {
  identifier: string;
  name: string;
  data?: Buffer;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface NumberResource {
  name: string;
  currentValue: number;
  maxValue: number;
}

export interface BaseUdonariumObject {
  id: string;
  type: ObjectType;
  name: string;
  position: Vector3;
  images: ImageRef[];
  properties: Map<string, string | number>;
}

export interface GameCharacter extends BaseUdonariumObject {
  type: 'character';
  size: number;
  resources: NumberResource[];
}

export interface Card extends BaseUdonariumObject {
  type: 'card';
  size?: number;
  isFaceUp: boolean;
  frontImage: ImageRef | null;
  backImage: ImageRef | null;
}

export interface CardStack extends BaseUdonariumObject {
  type: 'card-stack';
  cards: Card[];
}

export interface Terrain extends BaseUdonariumObject {
  type: 'terrain';
  isLocked: boolean;
  mode: number;
  rotate: number;
  locationName: string;
  width: number;
  height: number;
  depth: number;
  wallImage: ImageRef | null;
  floorImage: ImageRef | null;
}

/**
 * Types that can be children of a GameTable.
 * Excludes GameTable itself to avoid circular type reference.
 */
export type GameTableChild = GameCharacter | Card | CardStack | Terrain | TableMask | TextNote;

export interface GameTable extends BaseUdonariumObject {
  type: 'table';
  width: number;
  height: number;
  gridType: string;
  gridColor: string;
  children: GameTableChild[];
}

export interface TableMask extends BaseUdonariumObject {
  type: 'table-mask';
  isLock: boolean;
  width: number;
  height: number;
}

export interface TextNote extends BaseUdonariumObject {
  type: 'text-note';
  text: string;
  fontSize: number;
}

export type UdonariumObject =
  | GameCharacter
  | Card
  | CardStack
  | Terrain
  | GameTable
  | TableMask
  | TextNote;
