/**
 * Unit tests for security utilities
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { sanitizePath, verifyBasicAuth, getClientIP } from '../security';

describe('sanitizePath', () => {
  test('allows valid relative paths', () => {
    expect(sanitizePath('folder/file.jpg')).toBe('folder/file.jpg');
    expect(sanitizePath('wedding/RAW/IMG_0001.CR2')).toBe('wedding/RAW/IMG_0001.CR2');
    expect(sanitizePath('photos/2024/january/photo.png')).toBe('photos/2024/january/photo.png');
  });

  test('allows paths with spaces', () => {
    expect(sanitizePath('My Photos/vacation.jpg')).toBe('My Photos/vacation.jpg');
  });

  test('allows paths with dashes and underscores', () => {
    expect(sanitizePath('client-photos/IMG_0001.jpg')).toBe('client-photos/IMG_0001.jpg');
  });

  test('removes leading slashes', () => {
    expect(sanitizePath('/folder/file.jpg')).toBe('folder/file.jpg');
    expect(sanitizePath('//folder/file.jpg')).toBe('folder/file.jpg');
  });

  test('collapses multiple slashes', () => {
    expect(sanitizePath('folder//file.jpg')).toBe('folder/file.jpg');
    expect(sanitizePath('folder///subfolder//file.jpg')).toBe('folder/subfolder/file.jpg');
  });

  test('removes trailing slashes', () => {
    expect(sanitizePath('folder/file.jpg/')).toBe('folder/file.jpg');
    expect(sanitizePath('folder/file.jpg//')).toBe('folder/file.jpg');
  });

  test('rejects parent directory traversal', () => {
    expect(() => sanitizePath('../etc/passwd')).toThrow('parent directory traversal');
    expect(() => sanitizePath('folder/../etc/passwd')).toThrow('parent directory traversal');
    expect(() => sanitizePath('folder/../../file.jpg')).toThrow('parent directory traversal');
  });

  test('rejects null bytes', () => {
    expect(() => sanitizePath('folder/file\0.jpg')).toThrow('null bytes');
  });

  test('rejects invalid characters', () => {
    expect(() => sanitizePath('folder/file<>.jpg')).toThrow('invalid characters');
    expect(() => sanitizePath('folder/file?.jpg')).toThrow('invalid characters');
    expect(() => sanitizePath('folder/file*.jpg')).toThrow('invalid characters');
  });

  test('rejects empty paths', () => {
    expect(() => sanitizePath('')).toThrow('empty path');
  });
});

describe('verifyBasicAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('allows all requests when no credentials configured', () => {
    delete process.env.BASIC_AUTH_USERNAME;
    delete process.env.BASIC_AUTH_PASSWORD;

    expect(verifyBasicAuth(null)).toBe(true);
    expect(verifyBasicAuth('Bearer token')).toBe(true);
  });

  test('accepts valid Basic Auth credentials', () => {
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    const credentials = Buffer.from('testuser:testpass').toString('base64');
    expect(verifyBasicAuth(`Basic ${credentials}`)).toBe(true);
  });

  test('rejects invalid Basic Auth credentials', () => {
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    const credentials = Buffer.from('wronguser:wrongpass').toString('base64');
    expect(verifyBasicAuth(`Basic ${credentials}`)).toBe(false);
  });

  test('rejects missing Authorization header when credentials configured', () => {
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    expect(verifyBasicAuth(null)).toBe(false);
    expect(verifyBasicAuth('')).toBe(false);
  });

  test('rejects non-Basic auth schemes', () => {
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    expect(verifyBasicAuth('Bearer token123')).toBe(false);
  });

  test('rejects malformed Basic Auth', () => {
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    expect(verifyBasicAuth('Basic invalid!')).toBe(false);
    expect(verifyBasicAuth('Basic ')).toBe(false);
  });
});

describe('getClientIP', () => {
  test('extracts IP from x-forwarded-for header', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1',
    });

    expect(getClientIP(headers)).toBe('192.168.1.1');
  });

  test('extracts IP from x-real-ip header', () => {
    const headers = new Headers({
      'x-real-ip': '192.168.1.1',
    });

    expect(getClientIP(headers)).toBe('192.168.1.1');
  });

  test('prefers x-forwarded-for over x-real-ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1',
      'x-real-ip': '10.0.0.1',
    });

    expect(getClientIP(headers)).toBe('192.168.1.1');
  });

  test('returns unknown when no IP headers present', () => {
    const headers = new Headers();
    expect(getClientIP(headers)).toBe('unknown');
  });

  test('trims whitespace from IP', () => {
    const headers = new Headers({
      'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
    });

    expect(getClientIP(headers)).toBe('192.168.1.1');
  });
});
