import sharp from 'sharp';
import { KNOWN_IMAGES } from '../src/config/MappingConfig';

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}

async function main(): Promise<void> {
  console.log('Known image aspect ratio measurement');
  console.log('id\twidth\theight\tratio\thasAlpha');

  for (const [id, known] of KNOWN_IMAGES) {
    try {
      const buffer = await fetchBuffer(known.url);
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;
      const hasAlpha = metadata.hasAlpha ?? ((metadata.channels ?? 0) >= 4);
      if (!width || !height) {
        console.log(`${id}\tN/A\tN/A\tERROR: missing width/height\tN/A`);
        continue;
      }
      const ratio = height / width;
      console.log(`${id}\t${width}\t${height}\t${ratio.toFixed(6)}\t${hasAlpha}`);
    } catch (error) {
      console.log(
        `${id}\tN/A\tN/A\tERROR: ${error instanceof Error ? error.message : String(error)}\tN/A`
      );
    }
  }
}

void main();
