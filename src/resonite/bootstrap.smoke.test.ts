import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('ResoniteLink bootstrap smoke checks', () => {
  it('keeps native dynamic import loader for tsrl ESM package', () => {
    const clientTs = readWorkspaceFile('src/resonite/ResoniteLinkClient.ts');
    expect(clientTs).toContain('const importModule = new Function(');
    expect(clientTs).toContain("'return import(specifier);'");
  });

  it('ensures global WebSocket and passes ws constructor to tsrl', () => {
    const clientTs = readWorkspaceFile('src/resonite/ResoniteLinkClient.ts');
    expect(clientTs).toContain('ensureGlobalWebSocket();');
    expect(clientTs).toContain('ResoniteLink.connect(url, NodeWebSocket as never);');
  });
});
