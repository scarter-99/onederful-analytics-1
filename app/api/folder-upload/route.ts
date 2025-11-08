// API endpoint for folder upload to n8n

import { NextRequest, NextResponse } from 'next/server';
import type { UploadMetadata, UploadResponse } from '@/types/folder-upload';
import { ValidationError, RateLimitError, N8nError } from '@/types/folder-upload';
import { validateConfig, authConfig, uploadConfig } from '@/lib/folder-upload/config';
import { validateAuth, getClientIP, sanitizePath, getFileExtension } from '@/lib/folder-upload/validation';
import { checkRateLimit, getRateLimitInfo } from '@/lib/folder-upload/rate-limit';
import { forwardToN8n } from '@/lib/folder-upload/n8n-forwarder';

/**
 * Handle folder upload POST request
 */
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  const startTime = Date.now();

  try {
    // 0. Validate configuration
    validateConfig();

    // 1. Authentication (if enabled)
    if (authConfig.enabled) {
      const authHeader = request.headers.get('authorization');
      if (!validateAuth(authHeader, authConfig.username!, authConfig.password!)) {
        return NextResponse.json(
          { ok: false, error: 'UNAUTHORIZED', message: 'Invalid credentials' },
          { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Folder Upload"' } }
        );
      }
    }

    // 2. Rate limiting
    const clientIP = getClientIP(request);
    try {
      checkRateLimit(clientIP);
    } catch (error) {
      if (error instanceof RateLimitError) {
        const rateLimitInfo = getRateLimitInfo(clientIP);
        return NextResponse.json(
          {
            ok: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many uploads. Please try again later.',
            details: { retryAfter: error.retryAfter, remaining: rateLimitInfo.remaining },
          },
          {
            status: 429,
            headers: {
              'Retry-After': error.retryAfter.toString(),
              'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(rateLimitInfo.resetAt).toISOString(),
            },
          }
        );
      }
      throw error;
    }

    // 3. Parse multipart form data
    const formData = await request.formData();

    // Extract metadata
    const metaString = formData.get('meta') as string | null;
    let metadata: UploadMetadata = {};

    if (metaString) {
      try {
        metadata = JSON.parse(metaString);
      } catch {
        throw new ValidationError('Invalid metadata JSON');
      }
    }

    // Add timestamp
    metadata.uploadTimestamp = new Date().toISOString();

    // 4. Extract and validate files
    const fileEntries = formData.getAll('files[]');

    if (fileEntries.length === 0) {
      throw new ValidationError('No files provided');
    }

    if (fileEntries.length > uploadConfig.maxFileCount) {
      throw new ValidationError(
        `Too many files (${fileEntries.length}). Maximum is ${uploadConfig.maxFileCount}`
      );
    }

    // Validate files
    let totalSize = 0;
    const validatedFiles: Array<{ file: File; relativePath: string }> = [];

    for (const entry of fileEntries) {
      if (!(entry instanceof File)) {
        throw new ValidationError('Invalid file entry');
      }

      const file = entry as File;
      const relativePath = sanitizePath(file.name);

      // Validate extension
      const ext = getFileExtension(relativePath);
      if (!uploadConfig.allowedExtensions.includes(ext)) {
        throw new ValidationError(
          `File "${relativePath}" has disallowed extension: ${ext}. Allowed: ${uploadConfig.allowedExtensions.join(', ')}`
        );
      }

      // Validate size
      if (file.size > uploadConfig.maxFileSize) {
        throw new ValidationError(
          `File "${relativePath}" exceeds max size (${uploadConfig.maxFileSize} bytes)`
        );
      }

      totalSize += file.size;

      // Check total size
      if (totalSize > uploadConfig.maxTotalSize) {
        throw new ValidationError(
          `Total upload size exceeds limit (${uploadConfig.maxTotalSize} bytes)`
        );
      }

      validatedFiles.push({ file, relativePath });
    }

    console.log('[UPLOAD] Received', {
      ip: clientIP,
      fileCount: validatedFiles.length,
      totalSize,
      metadata,
    });

    // 5. Prepare FormData for n8n (recreate to ensure proper formatting)
    const n8nFormData = new FormData();

    // Add files with sanitized paths
    for (const { file, relativePath } of validatedFiles) {
      n8nFormData.append('files[]', file, relativePath);
    }

    // Add metadata
    n8nFormData.append('meta', JSON.stringify(metadata));

    // 6. Forward to n8n
    const n8nResult = await forwardToN8n(
      n8nFormData,
      metadata,
      validatedFiles.length,
      totalSize
    );

    const duration = Date.now() - startTime;

    console.log('[UPLOAD] Success', {
      ip: clientIP,
      fileCount: validatedFiles.length,
      totalSize,
      n8nStatus: n8nResult.status,
      retries: n8nResult.retries,
      durationMs: duration,
    });

    // 7. Return success response
    return NextResponse.json({
      ok: true,
      message: 'Upload successful. Files sent to n8n.',
      jobId: (n8nResult.data as { executionId?: string })?.executionId,
      filesProcessed: validatedFiles.length,
      totalBytes: totalSize,
      n8nResponse: {
        status: 'accepted',
        executionId: (n8nResult.data as { executionId?: string })?.executionId,
      },
    });

  } catch (error) {
    console.error('[UPLOAD] Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_FAILED',
          message: error.message,
          details: error.details,
        },
        { status: 400 }
      );
    }

    if (error instanceof N8nError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'WEBHOOK_FAILED',
          message: error.message,
          details: { status: error.status, retries: error.retries },
        },
        { status: 502 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        ok: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
