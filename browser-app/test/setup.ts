/**
 * Vitest Test Setup
 *
 * Global setup for browser-app tests.
 * Configures happy-dom environment and test utilities.
 */

import { vi } from 'vitest';

// Mock fetch for loading test fixtures
globalThis.fetch = vi.fn(async (url: string) => {
  // Handle fixture requests
  if (url.startsWith('/fixtures/') || url.startsWith('./fixtures/')) {
    const fs = await import('fs');
    const path = await import('path');
    const fixturePath = path.join(__dirname, url.replace(/^\.?\//, ''));

    if (fs.existsSync(fixturePath)) {
      const buffer = fs.readFileSync(fixturePath);
      return {
        ok: true,
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        text: async () => buffer.toString('utf-8'),
        json: async () => JSON.parse(buffer.toString('utf-8')),
      } as Response;
    }
  }

  // Handle locale requests
  if (url.startsWith('/locales/')) {
    const fs = await import('fs');
    const path = await import('path');
    const localePath = path.join(__dirname, '..', 'public', url.replace(/^\//, ''));

    if (fs.existsSync(localePath)) {
      const content = fs.readFileSync(localePath, 'utf-8');
      return {
        ok: true,
        json: async () => JSON.parse(content),
        text: async () => content,
      } as Response;
    }
  }

  throw new Error(`Fetch not mocked for: ${url}`);
}) as unknown as typeof fetch;

// Helper to create a File from a fixture path
export async function createFileFromFixture(
  fixturePath: string,
  fileName: string,
  mimeType: string
): Promise<File> {
  const fs = await import('fs');
  const path = await import('path');
  const fullPath = path.join(__dirname, 'fixtures', fixturePath);
  const buffer = fs.readFileSync(fullPath);
  return new File([buffer], fileName, { type: mimeType });
}

// Helper to read fixture as text
export async function readFixtureText(fixturePath: string): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  const fullPath = path.join(__dirname, 'fixtures', fixturePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// Helper to read fixture as ArrayBuffer
export async function readFixtureBuffer(fixturePath: string): Promise<ArrayBuffer> {
  const fs = await import('fs');
  const path = await import('path');
  const fullPath = path.join(__dirname, 'fixtures', fixturePath);
  const buffer = fs.readFileSync(fullPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
