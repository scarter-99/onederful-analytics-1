// tests/n8n-forwarder.test.ts
/**
 * Integration test for n8n forwarder
 * Verifies that:
 * 1. No manual content-type header is set (fetch auto-sets with boundary)
 * 2. Filenames are forwarded as relative paths
 * 3. FormData structure is preserved
 */

// Note: This test requires vitest to run
// Run with: npm test or vitest

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { forwardToN8nMultipart } from '../lib/folder-upload/n8n-forwarder';

const realFetch = globalThis.fetch;

beforeEach(() => {
  // Mock fetch to inspect what's being sent
  // @ts-ignore
  globalThis.fetch = vi.fn(async (_url, init: any) => {
    // The mock inspects the FormData parts
    const fd = init.body as FormData;
    const parts: Array<{name:string; filename?:string}> = [];

    // @ts-ignore - iterate FormData entries
    for (const [name, value] of (fd as any).entries()) {
      if (value && typeof value === 'object' && 'name' in value) {
        parts.push({ name, filename: (value as any).name });
      } else {
        parts.push({ name });
      }
    }

    // Verify no manual content-type was set
    const headers = init.headers || {};
    const hasManualContentType = Object.keys(headers).some(
      k => k.toLowerCase() === 'content-type'
    );

    return new Response(
      JSON.stringify({
        parts,
        hadManualContentType: hasManualContentType
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  });
});

afterEach(() => {
  // @ts-ignore
  globalThis.fetch = realFetch;
});

test('forwards filenames as relative paths and does not set content-type manually', async () => {
  const fd = new FormData();
  const blob = new Blob(['hello'], { type: 'text/plain' });
  const file = new File([blob], 'A/B/C.txt', { type: 'text/plain' });
  fd.append('files[]', file, 'A/B/C.txt');
  fd.append('meta', JSON.stringify({ x: 1 }));

  const out = await forwardToN8nMultipart({
    n8n: {
      webhookUrl: 'https://example.test/webhook',
      hookSecret: 's',
      clientId: 'c'
    },
    formData: fd,
    fileCount: 1,
    totalBytes: 5,
    batchId: 'batch-1',
    metaJson: JSON.stringify({ x: 1 }),
  });

  expect(out.ok).toBe(true);

  // Parse response to check our assertions
  const response = JSON.parse(out.bodyText);

  // Ensure no manual content-type was set (fetch auto-sets with boundary)
  expect(response.hadManualContentType).toBe(false);

  // Ensure our mock saw parts and relative filename
  const filePart = response.parts.find((p: any) => p.name === 'files[]');
  expect(filePart).toBeDefined();
  expect(filePart?.filename).toBe('A/B/C.txt');
});

test('preserves nested folder paths', async () => {
  const fd = new FormData();

  // Simulate multiple files with different nested paths
  const files = [
    { content: 'raw1', path: 'wedding/RAW/IMG_0001.CR2' },
    { content: 'raw2', path: 'wedding/RAW/IMG_0002.CR2' },
    { content: 'jpeg1', path: 'wedding/JPEG/IMG_0001.jpg' },
  ];

  for (const { content, path } of files) {
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const file = new File([blob], path, { type: 'application/octet-stream' });
    fd.append('files[]', file, path);
  }

  fd.append('meta', JSON.stringify({ shootName: 'Wedding 2024' }));

  const out = await forwardToN8nMultipart({
    n8n: {
      webhookUrl: 'https://example.test/webhook',
      hookSecret: 's',
      clientId: 'c'
    },
    formData: fd,
    fileCount: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.content.length, 0),
    batchId: 'batch-2',
    metaJson: JSON.stringify({ shootName: 'Wedding 2024' }),
  });

  expect(out.ok).toBe(true);

  const response = JSON.parse(out.bodyText);
  const fileParts = response.parts.filter((p: any) => p.name === 'files[]');

  // Verify all files have correct nested paths
  expect(fileParts).toHaveLength(3);
  expect(fileParts[0].filename).toBe('wedding/RAW/IMG_0001.CR2');
  expect(fileParts[1].filename).toBe('wedding/RAW/IMG_0002.CR2');
  expect(fileParts[2].filename).toBe('wedding/JPEG/IMG_0001.jpg');
});

test('includes required headers but not content-type', async () => {
  const fd = new FormData();
  const blob = new Blob(['test'], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });
  fd.append('files[]', file, 'folder/test.txt');

  // Use a custom fetch mock to inspect headers
  // @ts-ignore
  globalThis.fetch = vi.fn(async (_url, init: any) => {
    const headers = init.headers || {};

    return new Response(
      JSON.stringify({
        receivedHeaders: Object.keys(headers)
      }),
      { status: 200 }
    );
  });

  const out = await forwardToN8nMultipart({
    n8n: {
      webhookUrl: 'https://example.test/webhook',
      hookSecret: 'secret123',
      clientId: 'client456'
    },
    formData: fd,
    fileCount: 1,
    totalBytes: 4,
    batchId: 'batch-3',
    metaJson: JSON.stringify({ test: true }),
  });

  expect(out.ok).toBe(true);

  const response = JSON.parse(out.bodyText);

  // Should have our custom headers
  expect(response.receivedHeaders).toContain('x-hook-secret');
  expect(response.receivedHeaders).toContain('x-client-id');
  expect(response.receivedHeaders).toContain('x-file-total-count');
  expect(response.receivedHeaders).toContain('x-file-total-bytes');
  expect(response.receivedHeaders).toContain('x-batch-id');
  expect(response.receivedHeaders).toContain('x-meta-sha256');

  // Should NOT have manual content-type
  expect(response.receivedHeaders.some((h: string) => h.toLowerCase() === 'content-type')).toBe(false);
});
