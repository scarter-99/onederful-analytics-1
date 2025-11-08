// Validation utilities for folder upload

import type { UploadFile, UploadValidationResult } from '@/types/folder-upload';
import { uploadConfig } from './config';

/**
 * Sanitize file path to prevent traversal attacks
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '')      // Remove parent directory references
    .replace(/^\/+/, '')        // Remove leading slashes
    .replace(/\/+/g, '/')       // Normalize multiple slashes
    .replace(/[<>:"|?*\x00-\x1f]/g, ''); // Remove invalid chars
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '';
}

/**
 * Validate single file
 */
export function validateFile(file: UploadFile): string[] {
  const errors: string[] = [];

  // Check file size
  if (file.size > uploadConfig.maxFileSize) {
    errors.push(
      `File "${file.relativePath}" exceeds max size (${formatBytes(uploadConfig.maxFileSize)})`
    );
  }

  // Check file extension
  const ext = getFileExtension(file.relativePath);
  if (!uploadConfig.allowedExtensions.includes(ext)) {
    errors.push(
      `File "${file.relativePath}" has disallowed extension: ${ext}`
    );
  }

  // Check MIME type (if configured)
  if (uploadConfig.allowedMimeTypes.length > 0) {
    if (!uploadConfig.allowedMimeTypes.includes(file.type)) {
      errors.push(
        `File "${file.relativePath}" has disallowed MIME type: ${file.type}`
      );
    }
  }

  // Check for path traversal
  if (file.relativePath.includes('..')) {
    errors.push(
      `File "${file.relativePath}" contains path traversal attempt`
    );
  }

  return errors;
}

/**
 * Validate entire upload
 */
export function validateUpload(files: UploadFile[]): UploadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file count
  if (files.length === 0) {
    errors.push('No files selected');
  }

  if (files.length > uploadConfig.maxFileCount) {
    errors.push(
      `Too many files (${files.length}). Maximum is ${uploadConfig.maxFileCount}`
    );
  }

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > uploadConfig.maxTotalSize) {
    errors.push(
      `Total size (${formatBytes(totalSize)}) exceeds limit (${formatBytes(uploadConfig.maxTotalSize)})`
    );
  }

  // Validate each file
  for (const file of files) {
    const fileErrors = validateFile(file);
    errors.push(...fileErrors);
  }

  // Check for duplicate filenames
  const paths = new Set<string>();
  for (const file of files) {
    if (paths.has(file.relativePath)) {
      warnings.push(`Duplicate file: ${file.relativePath}`);
    }
    paths.add(file.relativePath);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalSize,
    fileCount: files.length,
  };
}

/**
 * Validate authentication credentials
 */
export function validateAuth(authHeader: string | null, username: string, password: string): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [user, pass] = credentials.split(':');
    return user === username && pass === password;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Generate unique batch ID
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `batch_${timestamp}_${random}`;
}

/**
 * Calculate SHA-256 hash of string
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract IP address from request
 */
export function getClientIP(request: Request): string {
  // Check Vercel forwarded IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check real IP
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Default upload limits
 */
export const DEFAULT_LIMITS = {
  maxFiles: 20000,
  maxPerFileBytes: 500 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  allowedExts: new Set(['jpg','jpeg','png','webp','tif','tiff','cr2','nef','arw','raf','orf','rw2']),
};

/**
 * Get file extension without dot
 */
export function extOf(name: string) {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? m[1] : '';
}

/**
 * Check if extension is allowed
 */
export function isAllowedExt(ext: string, allowed: Set<string>) {
  return allowed.has(ext);
}

/**
 * Normalize relative path
 */
export function normalizeRelPath(p: string) {
  return p.replace(/\\/g, '/')
          .replace(/^\/*/, '')
          .replace(/\/{2,}/g, '/')
          .replace(/(^|\/)\.\.(?=\/|$)/g, '')
          .replace(/(^|\/)\.(?=\/|$)/g, '')
          .trim();
}
