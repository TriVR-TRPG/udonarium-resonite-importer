import { describe, expect, it } from 'vitest';
import { convertTextNote } from './textNoteConverter';
import { TextNote } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../../config/ResoniteComponentTypes';

describe('convertTextNote', () => {
  it('creates TextNote slot with UIX.Text component', () => {
    const udonObj: TextNote = {
      id: 'note-1',
      type: 'text-note',
      name: 'Note',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      text: 'hello',
      fontSize: 14,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-note-1',
      name: 'Note',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTextNote(udonObj, resoniteObj.position, resoniteObj.id);

    expect(result.position).toEqual({ x: 0.5, y: 0, z: -0.5 });
    expect(result.components).toEqual([
      {
        id: 'slot-note-1-text',
        type: COMPONENT_TYPES.UIX_TEXT,
        fields: {
          Content: { $type: 'string', value: 'hello' },
          Size: { $type: 'float', value: 14 },
        },
      },
      {
        id: 'slot-note-1-collider',
        type: COMPONENT_TYPES.BOX_COLLIDER,
        fields: {
          Size: { $type: 'float3', value: { x: 1, y: 0.02, z: 1 } },
        },
      },
    ]);
  });

  it('clamps too-small fontSize to minimum', () => {
    const udonObj: TextNote = {
      id: 'note-2',
      type: 'text-note',
      name: 'Note',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      text: 'tiny',
      fontSize: 1,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-note-2',
      name: 'Note',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTextNote(udonObj, resoniteObj.position, resoniteObj.id);

    expect(result.position).toEqual({ x: 0.5, y: 0, z: -0.5 });
    expect(result.components[0].fields).toEqual({
      Content: { $type: 'string', value: 'tiny' },
      Size: { $type: 'float', value: 8 },
    });
    expect(result.components[1].fields).toEqual({
      Size: { $type: 'float3', value: { x: 1, y: 0.02, z: 1 } },
    });
  });
});
