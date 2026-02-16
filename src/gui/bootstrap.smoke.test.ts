import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('GUI bootstrap smoke checks', () => {
  it('index.html does not execute renderer.js directly', () => {
    const html = readWorkspaceFile('src/gui/index.html');
    expect(html).not.toMatch(/<script[^>]+renderer\.js/i);
  });

  it('main window keeps preload require path usable', () => {
    const mainTs = readWorkspaceFile('src/gui/main.ts');
    expect(mainTs).toMatch(/preload:\s*path\.join\(__dirname,\s*'preload\.js'\)/);
    expect(mainTs).toMatch(/contextIsolation:\s*true/);
    expect(mainTs).toMatch(/nodeIntegration:\s*false/);
    expect(mainTs).toMatch(/sandbox:\s*false/);
  });

  it('preload exposes and mirrors electronAPI before requiring renderer', () => {
    const preloadTs = readWorkspaceFile('src/gui/preload.ts');
    expect(preloadTs).toContain("contextBridge.exposeInMainWorld('electronAPI', api);");
    expect(preloadTs).toMatch(/window[^=]*electronAPI[^=]*=\s*api/);
    expect(preloadTs).toContain("window.addEventListener('DOMContentLoaded'");
    expect(preloadTs).toContain("void import('./renderer.js');");
  });
});
