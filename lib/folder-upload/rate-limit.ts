// Rate limiting for upload API

import type { RateLimitRecord } from '@/types/folder-upload';
import { RateLimitError } from '@/types/folder-upload';
import { rateLimitConfig } from './config';

// In-memory store (use Upstash Redis for production multi-instance)
const ipStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipStore.entries()) {
    if (now > record.resetAt) {
      ipStore.delete(ip);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check if IP has exceeded rate limit
 */
export function checkRateLimit(ip: string): void {
  if (!rateLimitConfig.enabled) {
    return;
  }

  const now = Date.now();
  const record = ipStore.get(ip);

  // No record or expired - create new
  if (!record || now > record.resetAt) {
    ipStore.set(ip, {
      count: 1,
      resetAt: now + rateLimitConfig.windowMs,
    });
    return;
  }

  // Check limit
  if (record.count >= rateLimitConfig.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }

  // Increment counter
  record.count++;
}

/**
 * Get remaining requests for IP
 */
export function getRateLimitInfo(ip: string): {
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const record = ipStore.get(ip);
  const now = Date.now();

  if (!record || now > record.resetAt) {
    return {
      remaining: rateLimitConfig.maxRequests,
      resetAt: now + rateLimitConfig.windowMs,
      limit: rateLimitConfig.maxRequests,
    };
  }

  return {
    remaining: Math.max(0, rateLimitConfig.maxRequests - record.count),
    resetAt: record.resetAt,
    limit: rateLimitConfig.maxRequests,
  };
}

/**
 * Reset rate limit for IP (admin function)
 */
export function resetRateLimit(ip: string): void {
  ipStore.delete(ip);
}
