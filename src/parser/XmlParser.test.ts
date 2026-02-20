import { describe, it, expect } from 'vitest';
import { parseXml, parseXmlFiles } from './XmlParser';
import { Terrain, GameCharacter, TextNote } from '../domain/UdonariumObject';

describe('XmlParser', () => {
  describe('parseXml', () => {
    describe('character parsing', () => {
      it('should parse basic character XML', () => {
        const xml = `
          <character identifier="char-001" location.x="100" location.y="200" posZ="50">
            <data name="character">
              <data name="image">
                <data name="imageIdentifier">#text=token123</data>
              </data>
              <data name="common">
                <data name="name">#text=Test Character</data>
                <data name="size">#text=2</data>
              </data>
            </data>
          </character>
        `;

        const result = parseXml(xml, 'test.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);

        const char = result.objects[0];
        expect(char.type).toBe('character');
        expect(char.id).toBe('char-001');
        expect(char.position).toEqual({ x: 100, y: 200, z: 50 });
      });

      it('should use fileName as fallback for missing name', () => {
        const xml = `
          <character identifier="char-001">
            <data name="character">
              <data name="common">
              </data>
            </data>
          </character>
        `;

        const result = parseXml(xml, 'fallback-name.xml');

        expect(result.objects[0].name).toBe('fallback-name.xml');
      });
    });

    describe('card parsing', () => {
      it('should parse card XML', () => {
        const xml = `
          <card identifier="card-001" location.x="50" location.y="75">
            <data name="card">
              <data name="image">
                <data name="front">#text=front123</data>
                <data name="back">#text=back123</data>
              </data>
              <data name="common">
                <data name="name">#text=Test Card</data>
              </data>
            </data>
          </card>
        `;

        const result = parseXml(xml, 'card.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('card');
      });
    });

    describe('dice-symbol parsing', () => {
      it('should parse dice-symbol XML and pick current face image', () => {
        const xml = `
          <dice-symbol identifier="dice-001" face="6" owner="" rotate="30" location.x="120" location.y="220" posZ="10">
            <data name="dice-symbol">
              <data name="image">
                <data type="image" name="1">dice-face-1</data>
                <data type="image" name="6">dice-face-6</data>
              </data>
              <data name="common">
                <data name="name">D6</data>
                <data name="size">1.5</data>
              </data>
            </data>
          </dice-symbol>
        `;

        const result = parseXml(xml, 'dice.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        const dice = result.objects[0];
        expect(dice.type).toBe('dice-symbol');
        expect(dice.position).toEqual({ x: 120, y: 220, z: 10 });
        if (dice.type === 'dice-symbol') {
          expect(dice.size).toBe(1.5);
          expect(dice.face).toBe('6');
          expect(dice.images[0]?.identifier).toBe('dice-face-6');
          expect(dice.faceImages).toHaveLength(2);
          expect(dice.faceImages[0]).toEqual({ identifier: 'dice-face-1', name: '1' });
          expect(dice.faceImages[1]).toEqual({ identifier: 'dice-face-6', name: '6' });
        }
      });
    });

    describe('card-stack parsing', () => {
      it('should parse card-stack XML', () => {
        const xml = `
          <card-stack identifier="stack-001">
            <data name="card-stack">
              <data name="common">
                <data name="name">#text=Deck</data>
              </data>
            </data>
          </card-stack>
        `;

        const result = parseXml(xml, 'stack.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('card-stack');
      });
    });

    describe('terrain parsing', () => {
      it('should parse terrain XML', () => {
        const xml = `
          <terrain identifier="terrain-001" location.x="0" location.y="0">
            <data name="terrain">
              <data name="common">
                <data name="name">#text=Wall</data>
              </data>
              <data name="altitude">
                <data name="width">#text=5</data>
                <data name="height">#text=3</data>
                <data name="depth">#text=1</data>
              </data>
            </data>
          </terrain>
        `;

        const result = parseXml(xml, 'terrain.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('terrain');
      });
    });

    describe('table parsing', () => {
      it('should parse table XML', () => {
        const xml = `
          <table identifier="table-001">
            <data name="table">
              <data name="common">
                <data name="name">#text=Game Table</data>
              </data>
              <data name="image">
                <data name="imageIdentifier">#text=table-bg</data>
              </data>
            </data>
          </table>
        `;

        const result = parseXml(xml, 'table.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('table');
      });
    });

    describe('table-mask parsing', () => {
      it('should parse table-mask XML', () => {
        const xml = `
          <table-mask identifier="mask-001" location.x="10" location.y="20">
            <data name="table-mask">
              <data name="common">
                <data name="name">#text=Fog of War</data>
              </data>
            </data>
          </table-mask>
        `;

        const result = parseXml(xml, 'mask.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('table-mask');
      });
    });

    describe('text-note parsing', () => {
      it('should parse text-note XML', () => {
        const xml = `
          <text-note identifier="note-001" location.x="300" location.y="150">
            <data name="text-note">
              <data name="common">
                <data name="name">#text=Session Notes</data>
              </data>
              <data name="note">
                <data name="text">#text=Hello World</data>
                <data name="fontSize">#text=16</data>
              </data>
            </data>
          </text-note>
        `;

        const result = parseXml(xml, 'note.xml');

        expect(result.errors).toHaveLength(0);
        expect(result.objects).toHaveLength(1);
        expect(result.objects[0].type).toBe('text-note');
      });
    });

    describe('error handling', () => {
      it('should handle malformed XML gracefully', () => {
        // Note: fast-xml-parser is lenient and may not throw for all invalid XML
        const invalidXml = '<invalid><unclosed>';

        const result = parseXml(invalidXml, 'invalid.xml');

        // Should not crash, may or may not have errors
        expect(result.objects).toHaveLength(0);
      });

      it('should handle empty XML content', () => {
        const result = parseXml('', 'empty.xml');

        expect(result.objects).toHaveLength(0);
        // Empty XML may or may not be an error depending on parser
      });

      it('should ignore unsupported tags', () => {
        const xml = `
          <unsupported-tag>
            <data name="something">value</data>
          </unsupported-tag>
        `;

        const result = parseXml(xml, 'unsupported.xml');

        expect(result.objects).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('multiple objects', () => {
      it('should parse only the first supported tag in XML', () => {
        // Note: XML typically has one root element,
        // but the parser checks for multiple supported tags
        const xml = `
          <character identifier="char-001">
            <data name="character">
              <data name="common">
                <data name="name">#text=Character</data>
              </data>
            </data>
          </character>
        `;

        const result = parseXml(xml, 'single.xml');

        expect(result.objects).toHaveLength(1);
      });
    });
  });

  describe('parseXmlFiles', () => {
    it('should parse multiple XML files', () => {
      const files = [
        {
          name: 'char1.xml',
          data: Buffer.from(`
            <character identifier="c1">
              <data name="character">
                <data name="common">
                  <data name="name">#text=Char1</data>
                </data>
              </data>
            </character>
          `),
        },
        {
          name: 'char2.xml',
          data: Buffer.from(`
            <character identifier="c2">
              <data name="character">
                <data name="common">
                  <data name="name">#text=Char2</data>
                </data>
              </data>
            </character>
          `),
        },
      ];

      const result = parseXmlFiles(files);

      expect(result.objects).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse files with unsupported content', () => {
      const files = [
        {
          name: 'valid.xml',
          data: Buffer.from(`
            <character identifier="c1">
              <data name="character">
                <data name="common">
                  <data name="name">#text=Valid</data>
                </data>
              </data>
            </character>
          `),
        },
        {
          name: 'unsupported.xml',
          data: Buffer.from('<unsupported-tag><data>value</data></unsupported-tag>'),
        },
      ];

      const result = parseXmlFiles(files);

      // Only the valid file produces an object
      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].id).toBe('c1');
    });

    it('should handle empty file array', () => {
      const result = parseXmlFiles([]);

      expect(result.objects).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle UTF-8 encoded content', () => {
      const files = [
        {
          name: 'japanese.xml',
          data: Buffer.from(
            `
            <character identifier="c1">
              <data name="character">
                <data name="common">
                  <data name="name">#text=日本語キャラクター</data>
                </data>
              </data>
            </character>
          `,
            'utf-8'
          ),
        },
      ];

      const result = parseXmlFiles(files);

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].name).toContain('日本語');
    });
  });

  describe('sample data (extracted from roomdata-sample.zip)', () => {
    // These test cases use XML fragments cut from the actual Udonarium save data.
    // Udonarium uses location.x / location.y / posZ for coordinates (NOT posX / posY).

    it('should parse terrain with location.x/location.y/posZ coordinates', () => {
      const xml = `
        <terrain isLocked="false" mode="3" rotate="0" location.name="table" location.x="575" location.y="175" posZ="100">
          <data name="terrain">
            <data name="image">
              <data type="image" name="imageIdentifier"></data>
              <data type="image" name="wall">./assets/images/tex.jpg</data>
              <data type="image" name="floor">./assets/images/tex.jpg</data>
            </data>
            <data name="common">
              <data name="name">地形</data>
              <data name="width">2</data>
              <data name="height">2</data>
              <data name="depth">2</data>
            </data>
            <data name="detail"></data>
          </data>
        </terrain>
      `;

      const result = parseXml(xml, 'terrain.xml');

      expect(result.errors).toHaveLength(0);
      expect(result.objects).toHaveLength(1);

      const terrain = result.objects[0] as Terrain;
      expect(terrain.type).toBe('terrain');
      expect(terrain.name).toBe('地形');
      expect(terrain.position).toEqual({ x: 575, y: 175, z: 100 });
      expect(terrain.isLocked).toBe(false);
      expect(terrain.mode).toBe(3);
      expect(terrain.rotate).toBe(0);
      expect(terrain.width).toBe(2);
      expect(terrain.height).toBe(2);
      expect(terrain.depth).toBe(2);
      expect(terrain.wallImage?.identifier).toBe('./assets/images/tex.jpg');
      expect(terrain.floorImage?.identifier).toBe('./assets/images/tex.jpg');
    });

    it('should parse terrain with posZ=0', () => {
      const xml = `
        <terrain isLocked="true" mode="3" rotate="0" location.name="table" location.x="775" location.y="450" posZ="0">
          <data name="terrain">
            <data name="image">
              <data type="image" name="imageIdentifier"></data>
              <data type="image" name="wall">./assets/images/tex.jpg</data>
              <data type="image" name="floor">./assets/images/tex.jpg</data>
            </data>
            <data name="common">
              <data name="name">地形</data>
              <data name="width">2</data>
              <data name="height">2</data>
              <data name="depth">2</data>
            </data>
            <data name="detail"></data>
          </data>
        </terrain>
      `;

      const result = parseXml(xml, 'terrain.xml');

      expect(result.errors).toHaveLength(0);
      const terrain = result.objects[0] as Terrain;
      expect(terrain.position).toEqual({ x: 775, y: 450, z: 0 });
      expect(terrain.isLocked).toBe(true);
      expect(terrain.mode).toBe(3);
      expect(terrain.rotate).toBe(0);
    });

    it('should parse terrain with different dimensions', () => {
      const xml = `
        <terrain isLocked="false" mode="3" rotate="0" location.name="table" location.x="525" location.y="175" posZ="0">
          <data name="terrain">
            <data name="image">
              <data type="image" name="imageIdentifier"></data>
              <data type="image" name="wall">./assets/images/tex.jpg</data>
              <data type="image" name="floor">./assets/images/tex.jpg</data>
            </data>
            <data name="common">
              <data name="name">地形</data>
              <data name="width">4</data>
              <data name="height">2</data>
              <data name="depth">3</data>
            </data>
            <data name="detail"></data>
          </data>
        </terrain>
      `;

      const result = parseXml(xml, 'terrain.xml');

      expect(result.errors).toHaveLength(0);
      const terrain = result.objects[0] as Terrain;
      expect(terrain.position).toEqual({ x: 525, y: 175, z: 0 });
      expect(terrain.width).toBe(4);
      expect(terrain.height).toBe(2);
      expect(terrain.depth).toBe(3);
    });

    it('should parse character with location.x/location.y coordinates', () => {
      const xml = `
        <character rotate="30" roll="0" location.name="table" location.x="250" location.y="450" posZ="0">
          <data name="character">
            <data name="image">
              <data type="image" name="imageIdentifier">testCharacter_1_image</data>
            </data>
            <data name="common">
              <data name="name">モンスターA</data>
              <data name="size">1</data>
            </data>
          </data>
        </character>
      `;

      const result = parseXml(xml, 'character.xml');

      expect(result.errors).toHaveLength(0);
      expect(result.objects).toHaveLength(1);

      const character = result.objects[0] as GameCharacter;
      expect(character.type).toBe('character');
      expect(character.name).toBe('モンスターA');
      expect(character.position).toEqual({ x: 250, y: 450, z: 0 });
      expect(character.size).toBe(1);
      expect(character.images[0].identifier).toBe('testCharacter_1_image');
    });

    it('should parse text-note with location.x/location.y coordinates', () => {
      const xml = `
        <text-note rotate="0" zindex="0" password="" location.name="table" location.x="875" location.y="200" posZ="0">
          <data name="text-note">
            <data name="image">
              <data type="image" name="imageIdentifier"></data>
            </data>
            <data name="common">
              <data name="width">4</data>
              <data name="height">3</data>
              <data name="fontsize">5</data>
              <data name="title">共有メモ</data>
              <data type="note" currentValue="テキストを入力してください" name="text">てすとテキスト</data>
            </data>
            <data name="detail"></data>
          </data>
        </text-note>
      `;

      const result = parseXml(xml, 'note.xml');

      expect(result.errors).toHaveLength(0);
      expect(result.objects).toHaveLength(1);

      const note = result.objects[0] as TextNote;
      expect(note.type).toBe('text-note');
      expect(note.name).toBe('共有メモ');
      expect(note.position).toEqual({ x: 875, y: 200, z: 0 });
    });

    it('should parse card-stack with location.x/location.y and nested cards', () => {
      const xml = `
        <card-stack rotate="0" zindex="13" owner="" isShowTotal="true" location.name="table" location.x="750" location.y="625" posZ="0">
          <data name="card-stack">
            <data name="image">
              <data type="image" name="imageIdentifier"></data>
            </data>
            <data name="common">
              <data name="name">トランプ山札</data>
            </data>
            <data name="detail"></data>
          </data>
          <node name="cardRoot">
            <card state="0" rotate="180" owner="" zindex="0" location.name="table" location.x="865.5179751952622" location.y="656.0392841109901" posZ="0">
              <data name="card">
                <data name="image">
                  <data type="image" name="imageIdentifier"></data>
                  <data type="image" name="front">./assets/images/trump/x01.gif</data>
                  <data type="image" name="back">./assets/images/trump/z02.gif</data>
                </data>
                <data name="common">
                  <data name="name">カード</data>
                  <data name="size">2</data>
                </data>
                <data name="detail"></data>
              </data>
            </card>
            <card state="0" rotate="0" owner="" zindex="0" location.name="table" location.x="865.5179751952622" location.y="656.0392841109901" posZ="0">
              <data name="card">
                <data name="image">
                  <data type="image" name="imageIdentifier"></data>
                  <data type="image" name="front">./assets/images/trump/c04.gif</data>
                  <data type="image" name="back">./assets/images/trump/z02.gif</data>
                </data>
                <data name="common">
                  <data name="name">カード</data>
                  <data name="size">2</data>
                </data>
                <data name="detail"></data>
              </data>
            </card>
          </node>
        </card-stack>
      `;

      const result = parseXml(xml, 'stack.xml');

      expect(result.errors).toHaveLength(0);
      // Only card-stack at top level; cards are NOT duplicated as standalone objects
      const stacks = result.objects.filter((o) => o.type === 'card-stack');
      const standaloneCards = result.objects.filter((o) => o.type === 'card');

      expect(stacks).toHaveLength(1);
      expect(standaloneCards).toHaveLength(0); // cards only inside card-stack.cards

      const stack = stacks[0];
      expect(stack.name).toBe('トランプ山札');
      expect(stack.position).toEqual({ x: 750, y: 625, z: 0 });

      // Cards are inside the stack's cards array
      if (stack.type === 'card-stack') {
        expect(stack.cards).toHaveLength(2);
        expect(stack.cards[0].position.x).toBeCloseTo(865.518, 2);
        expect(stack.cards[0].position.y).toBeCloseTo(656.039, 2);
      }
    });

    it('should parse room data with game-table containing terrains', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <room>
          <game-table name="最初のテーブル" width="20" height="15" gridSize="50" imageIdentifier="testTableBackgroundImage_image" backgroundImageIdentifier="imageIdentifier" backgroundFilterType="" selected="false" gridType="0" gridColor="#000000e6">
            <terrain isLocked="false" mode="3" rotate="0" location.name="table" location.x="575" location.y="175" posZ="100">
              <data name="terrain">
                <data name="image">
                  <data type="image" name="imageIdentifier"></data>
                  <data type="image" name="wall">./assets/images/tex.jpg</data>
                  <data type="image" name="floor">./assets/images/tex.jpg</data>
                </data>
                <data name="common">
                  <data name="name">地形</data>
                  <data name="width">2</data>
                  <data name="height">2</data>
                  <data name="depth">2</data>
                </data>
                <data name="detail"></data>
              </data>
            </terrain>
          </game-table>
          <character rotate="0" roll="0" location.name="table" location.x="200" location.y="100" posZ="0">
            <data name="character">
              <data name="image">
                <data type="image" name="imageIdentifier">testCharacter_3_image</data>
              </data>
              <data name="common">
                <data name="name">モンスターC</data>
                <data name="size">3</data>
              </data>
              <data name="detail"></data>
            </data>
          </character>
        </room>
      `;

      const result = parseXml(xml, 'data.xml');

      expect(result.errors).toHaveLength(0);

      const tables = result.objects.filter((o) => o.type === 'table');
      const topLevelTerrains = result.objects.filter((o) => o.type === 'terrain');
      const characters = result.objects.filter((o) => o.type === 'character');

      expect(tables).toHaveLength(1);
      // Terrain is inside game-table's children, NOT at top level
      expect(topLevelTerrains).toHaveLength(0);
      expect(characters).toHaveLength(1);

      // Terrain is a child of the table
      const table = tables[0];
      if (table.type === 'table') {
        expect(table.children).toHaveLength(1);
        const terrain = table.children[0];
        expect(terrain.type).toBe('terrain');
        expect(terrain.position).toEqual({ x: 575, y: 175, z: 100 });
      }

      const character = characters[0];
      expect(character.name).toBe('モンスターC');
      expect(character.position).toEqual({ x: 200, y: 100, z: 0 });
      expect(character.size).toBe(3);
    });
  });
});
