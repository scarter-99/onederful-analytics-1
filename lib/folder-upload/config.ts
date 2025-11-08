// Configuration for folder upload system

import type { UploadConfig } from '@/types/folder-upload';

function parseSize(sizeStr: string | undefined, defaultValue: number): number {
  if (!sizeStr) return defaultValue;

  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!match) return defaultValue;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  return Math.floor(value * (units[unit] || 1));
}

function parseList(str: string | undefined, defaultValue: string[]): string[] {
  if (!str) return defaultValue;
  return str
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const uploadConfig: UploadConfig = {
  maxFileSize: parseSize(process.env.MAX_FILE_SIZE, 50 * 1024 * 1024), // 50 MB
  maxTotalSize: parseSize(process.env.MAX_TOTAL_SIZE, 2 * 1024 * 1024 * 1024), // 2 GB
  maxFileCount: parseInt(process.env.MAX_FILE_COUNT || '1000', 10),

  allowedExtensions: parseList(
    process.env.ALLOWED_EXTENSIONS,
    ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng']
  ),

  allowedMimeTypes: parseList(
    process.env.ALLOWED_MIME_TYPES,
    ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
  ),

  enableChecksumValidation: process.env.ENABLE_CHECKSUM_VALIDATION !== 'false',
  enableMimeTypeVerification: process.env.ENABLE_MIME_TYPE_VERIFICATION !== 'false',
};

export const n8nConfig = {
  webhookUrl: process.env.N8N_WEBHOOK_URL!,
  hookSecret: process.env.N8N_HOOK_SECRET!,
  clientId: process.env.CLIENT_ID || 'default_client',
  retryAttempts: parseInt(process.env.N8N_RETRY_ATTEMPTS || '2', 10),
  retryBackoff: (process.env.N8N_RETRY_BACKOFF || '500,1500')
    .split(',')
    .map((s) => parseInt(s, 10)),
  timeout: parseInt(process.env.N8N_TIMEOUT || '60000', 10),
};

export const authConfig = {
  enabled: process.env.AUTH_ENABLED === 'true',
  username: process.env.AUTH_USERNAME,
  password: process.env.AUTH_PASSWORD,
};

export const rateLimitConfig = {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300000', 10), // 5 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
};

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Folder Upload',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',
  logUploads: process.env.LOG_UPLOADS !== 'false',
};

// Validate required config
export function validateConfig(): void {
  if (!n8nConfig.webhookUrl) {
    throw new Error('N8N_WEBHOOK_URL environment variable is required');
  }
  if (!n8nConfig.hookSecret) {
    throw new Error('N8N_HOOK_SECRET environment variable is required');
  }
  if (authConfig.enabled && (!authConfig.username || !authConfig.password)) {
    throw new Error('AUTH_USERNAME and AUTH_PASSWORD required when AUTH_ENABLED=true');
  }
}

/**
 * Get configuration for n8n forwarding
 */
export function getConfig() {
  return {
    n8nWebhookUrl: n8nConfig.webhookUrl,
    n8nHookSecret: n8nConfig.hookSecret,
    clientId: n8nConfig.clientId,
    n8nTimeoutMs: n8nConfig.timeout,
    n8nRetries: n8nConfig.retryAttempts,
    maxFileBytes: uploadConfig.maxFileSize,
    maxTotalBytes: uploadConfig.maxTotalSize,
    maxFiles: uploadConfig.maxFileCount,
    allowedExts: new Set(uploadConfig.allowedExtensions.map(ext => ext.replace(/^\./, ''))),
  };
}
