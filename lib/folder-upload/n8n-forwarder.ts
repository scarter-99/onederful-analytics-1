// n8n webhook forwarding with retry logic

import type { UploadMetadata, N8nWebhookHeaders } from '@/types/folder-upload';
import { N8nError } from '@/types/folder-upload';
import { n8nConfig } from './config';
import { generateBatchId, hashString } from './validation';

/**
 * Check if error should trigger retry
 */
function shouldRetry(status: number, error: Error | null): boolean {
  // Retry on 5xx errors
  if (status >= 500 && status < 600) {
    return true;
  }

  // Retry on network errors
  if (error && (error.name === 'FetchError' || error.message.includes('ECONNRESET'))) {
    return true;
  }

  return false;
}

/**
 * Delay for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Forward files to n8n webhook with retry
 */
export async function forwardToN8n(
  formData: FormData,
  metadata: UploadMetadata,
  fileCount: number,
  totalBytes: number
): Promise<{
  status: number;
  data: unknown;
  retries: number;
}> {
  const batchId = generateBatchId();
  const metaHash = await hashString(JSON.stringify(metadata));

  // Prepare headers
  const headers: N8nWebhookHeaders = {
    'x-hook-secret': n8nConfig.hookSecret,
    'x-client-id': n8nConfig.clientId,
    'x-file-total-count': fileCount.toString(),
    'x-file-total-bytes': totalBytes.toString(),
    'x-batch-id': batchId,
    'x-meta-sha256': metaHash,
    'content-type': 'multipart/form-data',
  };

  let lastError: Error | null = null;
  let lastStatus = 0;

  // Try initial request + retries
  for (let attempt = 0; attempt <= n8nConfig.retryAttempts; attempt++) {
    try {
      console.log(`[N8N] Attempt ${attempt + 1}/${n8nConfig.retryAttempts + 1}`, {
        batchId,
        fileCount,
        totalBytes,
        url: n8nConfig.webhookUrl,
      });

      // Create controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), n8nConfig.timeout);

      const response = await fetch(n8nConfig.webhookUrl, {
        method: 'POST',
        headers: headers as unknown as HeadersInit,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      lastStatus = response.status;

      // Success
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log('[N8N] Success', {
          batchId,
          status: response.status,
          executionId: data.executionId,
          attempt: attempt + 1,
        });

        return {
          status: response.status,
          data,
          retries: attempt,
        };
      }

      // Check if should retry
      if (!shouldRetry(response.status, null)) {
        // Non-retryable error (4xx)
        const errorText = await response.text();
        throw new N8nError(
          `n8n rejected upload: ${response.statusText}. ${errorText}`,
          response.status,
          attempt
        );
      }

      // Prepare for retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      console.warn(`[N8N] Attempt ${attempt + 1} failed with ${response.status}, will retry`, {
        batchId,
      });

    } catch (error) {
      lastError = error as Error;
      lastStatus = 0;

      // Check if should retry
      if (!shouldRetry(lastStatus, lastError)) {
        throw new N8nError(
          `n8n request failed: ${lastError.message}`,
          lastStatus,
          attempt
        );
      }

      console.warn(`[N8N] Attempt ${attempt + 1} failed, will retry`, {
        batchId,
        error: lastError.message,
      });
    }

    // Wait before retry (except on last attempt)
    if (attempt < n8nConfig.retryAttempts) {
      const backoffMs = n8nConfig.retryBackoff[Math.min(attempt, n8nConfig.retryBackoff.length - 1)];
      console.log(`[N8N] Waiting ${backoffMs}ms before retry ${attempt + 2}`);
      await delay(backoffMs);
    }
  }

  // All retries exhausted
  throw new N8nError(
    `n8n webhook failed after ${n8nConfig.retryAttempts + 1} attempts: ${lastError?.message || 'Unknown error'}`,
    lastStatus,
    n8nConfig.retryAttempts
  );
}

/**
 * Test n8n webhook connection
 */
export async function testN8nConnection(): Promise<boolean> {
  try {
    const response = await fetch(n8nConfig.webhookUrl, {
      method: 'OPTIONS',
      headers: {
        'x-hook-secret': n8nConfig.hookSecret,
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok || response.status === 405; // OPTIONS may not be allowed but webhook exists
  } catch (error) {
    console.error('[N8N] Connection test failed:', error);
    return false;
  }
}
