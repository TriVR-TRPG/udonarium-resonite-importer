/**
 * Udonarium object type definitions
 */

export type ObjectType =
  | 'character'
  | 'dice-symbol'
  | 'card'
  | 'card-stack'
  | 'terrain'
  | 'table'
  | 'table-mask'
  | 'text-note';

export interface ImageRef {
  identifier: string;
  name: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BaseUdonariumObject {
  id: string;
  type: ObjectType;
  name: string;
  position: Vector3;
  images: ImageRef[];
}

export interface GameCharacter extends BaseUdonariumObject {
  type: 'character';
  locationName: string;
  size: number;
  rotate: number;
  roll: number;
}

export interface DiceSymbol extends BaseUdonariumObject {
  type: 'dice-symbol';
  size: number;
  faceImages: ImageRef[];
  face: string;
  rotate: number;
}

export interface Card extends BaseUdonariumObject {
  type: 'card';
  size: number;
  rotate: number;
  isFaceUp: boolean;
  frontImage: ImageRef | null;
  backImage: ImageRef | null;
}

export interface CardStack extends BaseUdonariumObject {
  type: 'card-stack';
  rotate: number;
  cards: Card[];
}

export interface Terrain extends BaseUdonariumObject {
  type: 'terrain';
  isLocked: boolean;
  mode: number;
  rotate: number;
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
export type GameTableChild = Terrain | TableMask;

export interface GameTable extends BaseUdonariumObject {
  type: 'table';
  width: number;
  height: number;
  gridType: string;
  gridColor: string;
  selected: boolean;
  children: GameTableChild[];
}

export interface TableMask extends BaseUdonariumObject {
  type: 'table-mask';
  isLock: boolean;
  width: number;
  height: number;
  opacity: number;
}

export interface TextNote extends BaseUdonariumObject {
  type: 'text-note';
  text: string;
  fontSize: number;
}

export type UdonariumObject =
  | GameCharacter
  | DiceSymbol
  | Card
  | CardStack
  | Terrain
  | GameTable
  | TableMask
  | TextNote;
