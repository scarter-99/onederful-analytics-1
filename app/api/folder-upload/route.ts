// app/api/folder-upload/route.ts
import { NextRequest } from 'next/server';
import { forwardToN8nMultipart } from '@/lib/folder-upload/n8n-forwarder';
import { DEFAULT_LIMITS, normalizeRelPath, extOf, isAllowedExt } from '@/lib/folder-upload/validation';
import { getConfig } from '@/lib/folder-upload/config';
import { rateLimit } from '@/lib/folder-upload/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Optional: basic rate limiting
  const rl = await rateLimit(req);
  if (!rl.ok) {
    return new Response(JSON.stringify({ ok: false, message: 'Too many requests' }), { status: 429, headers: json });
  }

  const cfg = getConfig();
  // If you have Basic Auth on this route, validate here (omitted for brevity).

  const inForm = await req.formData(); // MVP: fine for Node 18; swap to streaming for very large sets
  const files: File[] = [];
  let metaJson = '';

  for (const [k, v] of inForm.entries()) {
    if (k === 'files[]' && v instanceof File) files.push(v);
    if (k === 'meta' && typeof v === 'string') metaJson = v;
  }
  if (!files.length) {
    return new Response(JSON.stringify({ ok: false, message: 'No files[] found' }), { status: 400, headers: json });
  }

  // Validate and rebuild outbound FormData
  const out = new FormData();
  let totalBytes = 0;
  let count = 0;

  for (const f of files) {
    const rel = normalizeRelPath(f.name); // browser set filename = webkitRelativePath
    const ext = extOf(rel);
    if (!isAllowedExt(ext, cfg.allowedExts ?? DEFAULT_LIMITS.allowedExts)) {
      return new Response(JSON.stringify({ ok: false, message: `Disallowed type: ${rel}` }), { status: 400, headers: json });
    }
    if (f.size > (cfg.maxFileBytes ?? DEFAULT_LIMITS.maxPerFileBytes)) {
      return new Response(JSON.stringify({ ok: false, message: `File too large: ${rel}` }), { status: 400, headers: json });
    }
    totalBytes += f.size;
    count++;
    if (totalBytes > (cfg.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes)) {
      return new Response(JSON.stringify({ ok: false, message: 'Total size exceeds limit' }), { status: 400, headers: json });
    }
    out.append('files[]', f, rel); // preserve relative paths
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
    headers: { ...json, 'x-retries': String(res.retries) },
  });
}

const json = { 'content-type': 'application/json; charset=utf-8' };
