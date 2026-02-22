import { describe, it, expect } from 'vitest';
import {
  findDataByName,
  getTextValue,
  getNumberValue,
  getBooleanValue,
  parsePosition,
} from './ParserUtils';

describe('ParserUtils', () => {
  describe('findDataByName', () => {
    it('should return null for null/undefined data', () => {
      expect(findDataByName(null, 'test')).toBeNull();
      expect(findDataByName(undefined, 'test')).toBeNull();
    });

    it('should find node by @_name attribute in single object', () => {
      const data = { '@_name': 'target', '#text': 'value' };
      const result = findDataByName(data, 'target');
      expect(result).toEqual(data);
    });

    it('should return null when name not found in single object', () => {
      const data = { '@_name': 'other', '#text': 'value' };
      const result = findDataByName(data, 'target');
      expect(result).toBeNull();
    });

    it('should find node by @_name attribute in array', () => {
      const target = { '@_name': 'target', '#text': 'found' };
      const data = [
        { '@_name': 'first', '#text': 'value1' },
        target,
        { '@_name': 'third', '#text': 'value3' },
      ];
      const result = findDataByName(data, 'target');
      expect(result).toEqual(target);
    });

    it('should return null when name not found in array', () => {
      const data = [
        { '@_name': 'first', '#text': 'value1' },
        { '@_name': 'second', '#text': 'value2' },
      ];
      const result = findDataByName(data, 'target');
      expect(result).toBeNull();
    });

    it('should search nested data in single object', () => {
      const nested = { '@_name': 'target', '#text': 'nested' };
      const data = {
        '@_name': 'parent',
        data: nested,
      };
      const result = findDataByName(data, 'target');
      expect(result).toEqual(nested);
    });

    it('should search nested data array', () => {
      const nested = { '@_name': 'target', '#text': 'nested' };
      const data = {
        '@_name': 'parent',
        data: [{ '@_name': 'other' }, nested],
      };
      const result = findDataByName(data, 'target');
      expect(result).toEqual(nested);
    });

    it('should search deeply nested data', () => {
      const deepNested = { '@_name': 'target', '#text': 'deep' };
      const data = [
        {
          '@_name': 'level1',
          data: {
            '@_name': 'level2',
            data: deepNested,
          },
        },
      ];
      const result = findDataByName(data, 'target');
      expect(result).toEqual(deepNested);
    });

    it('should handle empty array', () => {
      const result = findDataByName([], 'target');
      expect(result).toBeNull();
    });

    it('should handle non-object items in array', () => {
      const data = [null, undefined, 'string', 123, { '@_name': 'target' }];
      const result = findDataByName(data, 'target');
      expect(result).toEqual({ '@_name': 'target' });
    });
  });

  describe('getTextValue', () => {
    it('should return null for undefined node', () => {
      expect(getTextValue(undefined)).toBeNull();
    });

    it('should return text from #text property', () => {
      const node = { '#text': 'hello' };
      expect(getTextValue(node)).toBe('hello');
    });

    it('should convert number #text to string', () => {
      const node = { '#text': 42 };
      expect(getTextValue(node)).toBe('42');
    });

    it('should return text from nested data object', () => {
      const node = {
        data: { '#text': 'nested value' },
      };
      expect(getTextValue(node)).toBe('nested value');
    });

    it('should return text from nested data array', () => {
      const node = {
        data: [{ '@_name': 'first' }, { '#text': 'array value' }],
      };
      expect(getTextValue(node)).toBe('array value');
    });

    it('should return first found text in nested data array', () => {
      const node = {
        data: [{ '#text': 'first' }, { '#text': 'second' }],
      };
      expect(getTextValue(node)).toBe('first');
    });

    it('should return null when no #text found', () => {
      const node = { '@_name': 'notext' };
      expect(getTextValue(node)).toBeNull();
    });

    it('should handle empty string #text', () => {
      const node = { '#text': '' };
      expect(getTextValue(node)).toBe('');
    });

    it('should handle zero #text', () => {
      const node = { '#text': 0 };
      expect(getTextValue(node)).toBe('0');
    });
  });

  describe('getNumberValue', () => {
    it('should return null for null/undefined', () => {
      expect(getNumberValue(null)).toBeNull();
      expect(getNumberValue(undefined)).toBeNull();
    });

    it('should return number directly', () => {
      expect(getNumberValue(42)).toBe(42);
      expect(getNumberValue(3.14)).toBe(3.14);
      expect(getNumberValue(-10)).toBe(-10);
      expect(getNumberValue(0)).toBe(0);
    });

    it('should parse string number', () => {
      expect(getNumberValue('42')).toBe(42);
      expect(getNumberValue('3.14')).toBe(3.14);
      expect(getNumberValue('-10')).toBe(-10);
      expect(getNumberValue('0')).toBe(0);
    });

    it('should return null for non-numeric string', () => {
      expect(getNumberValue('hello')).toBeNull();
      expect(getNumberValue('')).toBeNull();
    });

    it('should parse string with whitespace', () => {
      expect(getNumberValue('  42  ')).toBe(42);
    });

    it('should extract number from DataNode', () => {
      const node = { '#text': '100' };
      expect(getNumberValue(node)).toBe(100);
    });

    it('should extract number from nested DataNode', () => {
      const node = { data: { '#text': 50 } };
      expect(getNumberValue(node)).toBe(50);
    });

    it('should return null for DataNode without text', () => {
      const node = { '@_name': 'novalue' };
      expect(getNumberValue(node)).toBeNull();
    });

    it('should handle NaN result', () => {
      expect(getNumberValue('NaN')).toBeNull();
    });

    it('should handle Infinity', () => {
      expect(getNumberValue('Infinity')).toBe(Infinity);
      expect(getNumberValue('-Infinity')).toBe(-Infinity);
    });
  });

  describe('getBooleanValue', () => {
    it('should return null for null/undefined', () => {
      expect(getBooleanValue(null)).toBeNull();
      expect(getBooleanValue(undefined)).toBeNull();
    });

    it('should return boolean directly', () => {
      expect(getBooleanValue(true)).toBe(true);
      expect(getBooleanValue(false)).toBe(false);
    });

    it('should parse string "true" (case-insensitive)', () => {
      expect(getBooleanValue('true')).toBe(true);
      expect(getBooleanValue('True')).toBe(true);
      expect(getBooleanValue('TRUE')).toBe(true);
      expect(getBooleanValue('tRuE')).toBe(true);
    });

    it('should parse string "false" and other values as false', () => {
      expect(getBooleanValue('false')).toBe(false);
      expect(getBooleanValue('False')).toBe(false);
      expect(getBooleanValue('FALSE')).toBe(false);
      expect(getBooleanValue('no')).toBe(false);
      expect(getBooleanValue('0')).toBe(false);
      expect(getBooleanValue('')).toBe(false);
      expect(getBooleanValue('anything')).toBe(false);
    });

    it('should extract boolean from DataNode', () => {
      const trueNode = { '#text': 'true' };
      const falseNode = { '#text': 'false' };
      expect(getBooleanValue(trueNode)).toBe(true);
      expect(getBooleanValue(falseNode)).toBe(false);
    });

    it('should extract boolean from nested DataNode', () => {
      const node = { data: { '#text': 'true' } };
      expect(getBooleanValue(node)).toBe(true);
    });

    it('should return null for DataNode without text', () => {
      const node = { '@_name': 'novalue' };
      expect(getBooleanValue(node)).toBeNull();
    });
  });

  describe('parsePosition', () => {
    it('should parse position from location.x/location.y/posZ', () => {
      const root = {
        '@_location.x': '575',
        '@_location.y': '175',
        '@_posZ': '100',
      };

      const pos = parsePosition(root);

      expect(pos.x).toBe(575);
      expect(pos.y).toBe(175);
      expect(pos.z).toBe(100);
    });

    it('should default to (0, 0, 0) when no position attributes present', () => {
      const root = {};

      const pos = parsePosition(root);

      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(pos.z).toBe(0);
    });

    it('should handle floating point coordinates', () => {
      const root = {
        '@_location.x': '865.5179751952622',
        '@_location.y': '656.0392841109901',
        '@_posZ': '0',
      };

      const pos = parsePosition(root);

      expect(pos.x).toBeCloseTo(865.518, 2);
      expect(pos.y).toBeCloseTo(656.039, 2);
      expect(pos.z).toBe(0);
    });
  });
});
