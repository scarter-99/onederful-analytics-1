// Type definitions for folder upload system

export interface UploadMetadata {
  clientId?: string;
  uploaderEmail?: string;
  shootName?: string;
  notes?: string;
  uploadTimestamp?: string;
}

export interface UploadFile {
  file: File;
  relativePath: string;
  size: number;
  type: string;
}

export interface UploadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalSize: number;
  fileCount: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message?: string;
}

export interface UploadResponse {
  ok: boolean;
  message?: string;
  jobId?: string;
  filesProcessed?: number;
  totalBytes?: number;
  n8nResponse?: {
    status: string;
    executionId?: string;
  };
  error?: string;
  details?: unknown;
}

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface N8nWebhookHeaders {
  'x-hook-secret': string;
  'x-client-id': string;
  'x-file-total-count': string;
  'x-file-total-bytes': string;
  'x-batch-id': string;
  'x-meta-sha256'?: string;
  'content-type': string;
}

export interface UploadConfig {
  maxFileSize: number;
  maxTotalSize: number;
  maxFileCount: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  enableChecksumValidation: boolean;
  enableMimeTypeVerification: boolean;
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

export class N8nError extends Error {
  constructor(message: string, public status: number, public retries: number) {
    super(message);
    this.name = 'N8nError';
  }
}
