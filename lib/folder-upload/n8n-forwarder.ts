// lib/folder-upload/n8n-forwarder.ts
import { createHash } from 'node:crypto';
import { Agent } from 'node:https';

export type N8nConfig = {
  webhookUrl: string;
  hookSecret: string;
  clientId: string;
  timeoutMs?: number;          // default 60000
  retries?: number;            // default 2
};

export type ForwardResult = {
  status: number;
  ok: boolean;
  bodyText: string;
  retries: number;
};

export async function forwardToN8nMultipart(opts: {
  n8n: N8nConfig;
  formData: FormData;          // already contains files[] with relative filenames and meta JSON
  fileCount: number;
  totalBytes: number;
  batchId?: string;
  metaJson?: string;           // same as appended 'meta' field; used to compute x-meta-sha256
}): Promise<ForwardResult> {
  const { n8n, formData, fileCount, totalBytes, batchId, metaJson } = opts;

  const headers: Record<string, string> = {
    'x-hook-secret': n8n.hookSecret,
    'x-client-id': n8n.clientId,
    'x-file-total-count': String(fileCount),
    'x-file-total-bytes': String(totalBytes),
  };
  if (batchId) headers['x-batch-id'] = batchId;
  if (metaJson) headers['x-meta-sha256'] = sha256(metaJson);

  // DO NOT set 'content-type' here. Let fetch derive it from FormData (includes boundary).
  const timeoutMs = n8n.timeoutMs ?? 60_000;
  const retries = n8n.retries ?? 2;

  const agent = new Agent({ keepAlive: true });

  let last: ForwardResult = { status: 0, ok: false, bodyText: '', retries: 0 };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(n8n.webhookUrl, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
        // @ts-expect-error - dispatcher is Node.js specific
        dispatcher: agent,
      });
      clearTimeout(t);
      const text = await res.text();
      last = { status: res.status, ok: res.ok, bodyText: text, retries: attempt };
      if (res.ok) return last;
      // retry on 5xx
      if (res.status >= 500) {
        await backoff(attempt);
        continue;
      }
      return last; // 4xx: do not retry
    } catch (err) {
      clearTimeout(t);
      const message = err instanceof Error ? err.message : String(err);
      last = { status: 0, ok: false, bodyText: message, retries: attempt };
      // network error → retry
      await backoff(attempt);
    }
  }
  return last;
}

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

async function backoff(i: number) {
  const ms = i === 0 ? 500 : 1500;
  await new Promise(r => setTimeout(r, ms));
}
