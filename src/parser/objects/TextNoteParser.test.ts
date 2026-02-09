/**
 * Tests for TextNoteParser
 */

import { describe, it, expect } from 'vitest';
import { parseTextNote } from './TextNoteParser';

describe('TextNoteParser', () => {
  describe('parseTextNote', () => {
    it('should parse basic text note with title and text', () => {
      const data = {
        '@_identifier': 'note-001',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'My Note' }],
              },
              { '@_name': 'note', '#text': 'This is the content of the note.' },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.id).toBe('note-001');
      expect(result.type).toBe('text-note');
      expect(result.name).toBe('My Note');
      expect(result.text).toBe('This is the content of the note.');
    });

    it('should use fileName as fallback for title and id', () => {
      const data = {
        data: [
          {
            '@_name': 'text-note',
            data: [],
          },
        ],
      };

      const result = parseTextNote(data, 'fallback-note.xml');

      expect(result.id).toBe('fallback-note.xml');
      expect(result.name).toBe('fallback-note.xml');
    });

    it('should default text to empty string', () => {
      const data = {
        '@_identifier': 'note-002',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Empty Note' }],
              },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.text).toBe('');
    });

    it('should parse fontSize', () => {
      const data = {
        '@_identifier': 'note-003',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Large Font Note' }],
              },
              { '@_name': 'fontSize', '#text': '24' },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.fontSize).toBe(24);
    });

    it('should default fontSize to 14', () => {
      const data = {
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Default Font' }],
              },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.fontSize).toBe(14);
    });

    it('should parse position', () => {
      const data = {
        '@_identifier': 'note-004',
        '@_posX': '100',
        '@_posY': '200',
        '@_posZ': '6',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Positioned Note' }],
              },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.position.x).toBe(100);
      expect(result.position.y).toBe(200);
      expect(result.position.z).toBe(6);
    });

    it('should default position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'text-note',
            data: [],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });

    it('should have empty images array', () => {
      const data = {
        '@_identifier': 'note-005',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.images).toHaveLength(0);
    });

    it('should handle multiline text', () => {
      const data = {
        '@_identifier': 'note-006',
        data: [
          {
            '@_name': 'text-note',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'title', '#text': 'Multiline' }],
              },
              { '@_name': 'note', '#text': 'Line 1\nLine 2\nLine 3' },
            ],
          },
        ],
      };

      const result = parseTextNote(data, 'test.xml');

      expect(result.text).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle empty data gracefully', () => {
      const data = {};

      const result = parseTextNote(data, 'empty.xml');

      expect(result.id).toBe('empty.xml');
      expect(result.name).toBe('empty.xml');
      expect(result.text).toBe('');
      expect(result.fontSize).toBe(14);
    });
  });
});
