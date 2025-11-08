// If your project already has this file with these exports, keep your version.
// Otherwise, use this minimal implementation.

export const DEFAULT_LIMITS = {
  maxFiles: 20000,
  maxPerFileBytes: 500 * 1024 * 1024,      // 500 MB
  maxTotalBytes: 2 * 1024 * 1024 * 1024,   // 2 GB
  allowedExts: new Set(['jpg','jpeg','png','webp','tif','tiff','cr2','nef','arw','raf','orf','rw2']),
};

export function extOf(name: string) {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? m[1] : '';
}

export function isAllowedExt(ext: string, allowed: Set<string>) {
  return allowed.has(ext);
}

export function normalizeRelPath(p: string) {
  return p
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/(^|\/)\.\.(?=\/|$)/g, '')
    .replace(/(^|\/)\.(?=\/|$)/g, '')
    .trim();
}
