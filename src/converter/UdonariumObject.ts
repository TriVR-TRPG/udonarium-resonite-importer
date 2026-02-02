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

export interface Vector2 {
  x: number;
  y: number;
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
  position: Vector2;
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
  width: number;
  height: number;
  depth: number;
  wallImage: ImageRef | null;
  floorImage: ImageRef | null;
}

export interface GameTable extends BaseUdonariumObject {
  type: 'table';
  width: number;
  height: number;
  gridType: string;
  gridColor: string;
}

export interface TableMask extends BaseUdonariumObject {
  type: 'table-mask';
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
