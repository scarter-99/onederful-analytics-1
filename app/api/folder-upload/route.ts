import { NextRequest } from 'next/server';
import { forwardToN8nMultipart } from '@/lib/folder-upload/n8n-forwarder';
import { DEFAULT_LIMITS, normalizeRelPath, extOf, isAllowedExt } from '@/lib/folder-upload/validation';
import { getConfig } from '@/lib/folder-upload/config';
import { rateLimit } from '@/lib/folder-upload/rate-limit';

export const runtime = 'nodejs';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.ok) {
    return new Response(JSON.stringify({ ok: false, message: 'Too many requests' }), { status: 429, headers: JSON_HEADERS });
  }

  const cfg = getConfig();

  // Parse inbound multipart (browser upload)
  const incoming = await req.formData();
  const files: File[] = [];
  let metaJson = '';

  for (const [k, v] of incoming.entries()) {
    if (k === 'files[]' && v instanceof File) files.push(v);
    else if (k === 'meta' && typeof v === 'string') metaJson = v;
  }

  if (!files.length) {
    return new Response(JSON.stringify({ ok: false, message: 'No files[] found' }), { status: 400, headers: JSON_HEADERS });
  }

  // Validate + rebuild outbound FormData to n8n
  const out = new FormData();
  let totalBytes = 0;
  let count = 0;

  const maxPerFile = cfg.maxFileBytes ?? DEFAULT_LIMITS.maxPerFileBytes;
  const maxTotal = cfg.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes;
  const allowed = cfg.allowedExts ?? DEFAULT_LIMITS.allowedExts;

  for (const f of files) {
    const rel = normalizeRelPath((f as any).name || f.name); // filename carries webkitRelativePath
    const ext = extOf(rel);

    if (!isAllowedExt(ext, allowed)) {
      return new Response(JSON.stringify({ ok: false, message: `Disallowed type: ${rel}` }), { status: 400, headers: JSON_HEADERS });
    }
    if (f.size > maxPerFile) {
      return new Response(JSON.stringify({ ok: false, message: `File too large: ${rel}` }), { status: 400, headers: JSON_HEADERS });
    }
    totalBytes += f.size;
    count++;
    if (totalBytes > maxTotal) {
      return new Response(JSON.stringify({ ok: false, message: 'Total size exceeds limit' }), { status: 400, headers: JSON_HEADERS });
    }

    out.append('files[]', f, rel); // preserve relative paths in filename
  }

  if (metaJson) out.append('meta', metaJson);

  const res = await forwardToN8nMultipart({
    n8n: {
      webhookUrl: cfg.n8nWebhookUrl,
      hookSecret: cfg.n8nHookSecret,
      clientId: cfg.clientId,
      timeoutMs: cfg.n8nTimeoutMs,
      retries: cfg.n8nRetries,
    },
    formData: out,
    fileCount: count,
    totalBytes,
    batchId: crypto.randomUUID(),
    metaJson,
  });

  const payload = res.bodyText || (res.ok ? 'OK' : 'Error');
  return new Response(payload, {
    status: res.ok ? 200 : (res.status || 502),
    headers: { ...JSON_HEADERS, 'x-retries': String(res.retries) },
  });
}
