/**
 * Security utilities for folder upload
 */

// Rate limiting (in-memory, single instance)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '30', 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '300000', 10); // 5 minutes

/**
 * Check if IP is within rate limit
 * @param ip - Client IP address
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // No entry or window expired - create new
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  // Increment count
  entry.count++;
  return true;
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 10 * 60 * 1000);
}

/**
 * Sanitize file path to prevent directory traversal
 * @param path - File path to sanitize
 * @returns Sanitized path
 * @throws Error if path contains invalid patterns
 */
export function sanitizePath(path: string): string {
  if (!path) {
    throw new Error('Invalid path: empty path');
  }

  // Remove leading slashes
  path = path.replace(/^\/+/, '');

  // Disallow parent directory traversal
  if (path.includes('..')) {
    throw new Error('Invalid path: parent directory traversal not allowed');
  }

  // Collapse multiple slashes
  path = path.replace(/\/+/g, '/');

  // Trim trailing slashes
  path = path.replace(/\/+$/, '');

  // Disallow absolute paths (after trimming)
  if (path.startsWith('/')) {
    throw new Error('Invalid path: absolute paths not allowed');
  }

  // Disallow null bytes
  if (path.includes('\0')) {
    throw new Error('Invalid path: null bytes not allowed');
  }

  // Check for valid characters (alphanumeric, dash, underscore, dot, slash, space)
  if (!/^[a-zA-Z0-9\-_./ ]+$/.test(path)) {
    throw new Error('Invalid path: contains invalid characters');
  }

  return path;
}

/**
 * Verify Basic Auth credentials
 * @param authHeader - Authorization header value
 * @returns true if valid, false otherwise
 */
export function verifyBasicAuth(authHeader: string | null): boolean {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // If no credentials configured, allow all
  if (!username || !password) {
    return true;
  }

  // Check header exists
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [providedUsername, providedPassword] = credentials.split(':');

    return providedUsername === username && providedPassword === password;
  } catch {
    return false;
  }
}

/**
 * Get security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    'Permissions-Policy': 'interest-cohort=()',
  };
}

/**
 * Generate SHA-256 hash of metadata
 */
export async function generateMetadataHash(metadata: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(metadata));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
