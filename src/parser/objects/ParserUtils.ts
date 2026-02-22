/**
 * Utility functions for parsing Udonarium XML data
 */

type DataNode = {
  '@_name'?: string;
  '@_type'?: string;
  '#text'?: string | number;
  data?: DataNode | DataNode[];
  [key: string]: unknown;
};

/**
 * Find data element by name attribute
 */
export function findDataByName(data: unknown, name: string): DataNode | null {
  if (!data) return null;

  // Handle array of data elements
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        const node = item as DataNode;
        if (node['@_name'] === name) {
          return node;
        }
        // Search nested data
        if (node.data) {
          const found = findDataByName(node.data, name);
          if (found) return found;
        }
      }
    }
    return null;
  }

  // Handle single data element
  if (typeof data === 'object') {
    const node = data as DataNode;
    if (node['@_name'] === name) {
      return node;
    }
    // Search nested data
    if (node.data) {
      return findDataByName(node.data, name);
    }
  }

  return null;
}

/**
 * Get text value from data node
 */
export function getTextValue(node?: DataNode | null): string | null {
  if (!node) return null;

  // Direct text content
  if (node['#text'] != null) {
    return String(node['#text']);
  }

  // Nested data with text
  if (node.data) {
    if (Array.isArray(node.data)) {
      for (const item of node.data) {
        if (item['#text'] != null) {
          return String(item['#text']);
        }
      }
    } else if (node.data['#text'] != null) {
      return String(node.data['#text']);
    }
  }

  return null;
}

/**
 * Get number value from data node or raw value
 */
export function getNumberValue(nodeOrValue: unknown): number | null {
  if (nodeOrValue == null) return null;

  // Direct number
  if (typeof nodeOrValue === 'number') {
    return nodeOrValue;
  }

  // String number
  if (typeof nodeOrValue === 'string') {
    const num = parseFloat(nodeOrValue);
    if (isNaN(num)) return null;
    return num;
  }

  // Data node
  if (typeof nodeOrValue === 'object' && nodeOrValue !== null) {
    const text = getTextValue(nodeOrValue as DataNode);
    if (text != null) {
      const num = parseFloat(text);
      if (isNaN(num)) return null;
      return num;
    }
  }

  return null;
}

/**
 * Parse position from XML element attributes.
 * Udonarium uses location.x/location.y for 2D position and posZ for Z axis.
 */
export function parsePosition(root: Record<string, unknown>): {
  x: number;
  y: number;
  z: number;
} {
  const x = getNumberValue(root['@_location.x']) ?? 0;
  const y = getNumberValue(root['@_location.y']) ?? 0;
  const z = getNumberValue(root['@_posZ']) ?? 0;
  return { x, y, z };
}

/**
 * Get boolean value from data node or raw value
 */
export function getBooleanValue(nodeOrValue: unknown): boolean | null {
  if (nodeOrValue == null) return null;

  // Direct boolean
  if (typeof nodeOrValue === 'boolean') {
    return nodeOrValue;
  }

  // String boolean
  if (typeof nodeOrValue === 'string') {
    return nodeOrValue.toLowerCase() === 'true';
  }

  // Data node
  if (typeof nodeOrValue === 'object' && nodeOrValue !== null) {
    const text = getTextValue(nodeOrValue as DataNode);
    if (text != null) {
      return text.toLowerCase() === 'true';
    }
  }

  return null;
}
