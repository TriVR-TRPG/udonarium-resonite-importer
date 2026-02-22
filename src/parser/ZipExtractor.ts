/**
 * ZIP extraction utilities for Udonarium save files
 */

import AdmZip from 'adm-zip';
import * as path from 'path';

export interface ExtractedFile {
  path: string;
  name: string;
  data: Buffer;
}

export interface ExtractedData {
  xmlFiles: ExtractedFile[];
  imageFiles: ExtractedFile[];
}

/**
 * Extract Udonarium save ZIP file
 */
export function extractZip(zipPath: string): ExtractedData {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const xmlFiles: ExtractedFile[] = [];
  const imageFiles: ExtractedFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const ext = path.extname(entry.entryName).toLowerCase();
    const file: ExtractedFile = {
      path: entry.entryName,
      name: path.basename(entry.entryName, ext),
      data: entry.getData(),
    };

    if (ext === '.xml') {
      xmlFiles.push(file);
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      imageFiles.push(file);
    }
  }

  return { xmlFiles, imageFiles };
}

/**
 * Get image data by identifier from extracted files
 */
export function getImageByIdentifier(imageFiles: ExtractedFile[], identifier: string) {
  return imageFiles.find((img) => img.name === identifier || img.path.includes(identifier));
}
