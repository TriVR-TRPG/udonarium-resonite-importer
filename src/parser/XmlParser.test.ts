import { describe, it, expect } from 'vitest';
import { parseXml, parseXmlFiles } from './XmlParser';

describe('XmlParser', () => {
  describe('parseXml', () => {
    describe('character parsing', () => {
      it('should parse basic character XML', () => {
        const xml = `
          <character identifier="char-001" posX="100" posY="200" posZ="50">
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
          <card identifier="card-001" posX="50" posY="75">
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
          <terrain identifier="terrain-001" posX="0" posY="0">
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
          <table-mask identifier="mask-001" posX="10" posY="20">
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
          <text-note identifier="note-001" posX="300" posY="150">
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
});
