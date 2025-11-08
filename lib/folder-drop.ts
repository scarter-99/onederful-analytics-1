// Configuration constants
export const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff',
  'cr2', 'nef', 'arw', 'raf', 'orf', 'rw2'
];

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
export const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
export const MAX_FILES = 20000;
export const INCLUDE_HIDDEN_FILES = false; // Toggle to include hidden files

export interface FileWithPath {
  file: File;
  relativePath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ProgressCallback {
  (filesDiscovered: number, bytesDiscovered: number): void;
}

/**
 * Check if the browser supports the FileSystem API
 */
export function supportsFileSystemAPI(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof DataTransferItem === 'undefined') {
    return false;
  }
  return 'webkitGetAsEntry' in DataTransferItem.prototype ||
         'getAsEntry' in DataTransferItem.prototype;
}

/**
 * Check if a file should be included based on extension
 */
function isAllowedExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
}

/**
 * Check if a file is hidden (starts with .)
 */
function isHiddenFile(filename: string): boolean {
  return filename.startsWith('.');
}

/**
 * Validate a single file
 */
export function validateFile(file: File, relativePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if hidden and should be excluded
  if (!INCLUDE_HIDDEN_FILES && isHiddenFile(file.name)) {
    errors.push(`Hidden file excluded: ${relativePath}`);
  }

  // Check extension
  if (!isAllowedExtension(file.name)) {
    errors.push(`Invalid file type: ${relativePath}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${relativePath}. Max ${formatBytes(MAX_FILE_SIZE)}`);
  }

  if (file.size === 0) {
    warnings.push(`Empty file: ${relativePath}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate all files
 */
export function validateFiles(files: FileWithPath[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check total count
  if (files.length > MAX_FILES) {
    errors.push(`Too many files: ${files.length}. Maximum allowed: ${MAX_FILES}`);
  }

  if (files.length === 0) {
    errors.push('No valid files found');
  }

  // Check total size
  const totalSize = files.reduce((sum, { file }) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push(`Total size too large: ${formatBytes(totalSize)}. Maximum: ${formatBytes(MAX_TOTAL_SIZE)}`);
  }

  // Validate individual files
  for (const { file, relativePath } of files) {
    const result = validateFile(file, relativePath);
    errors.push(...result.errors);
    if (result.warnings) {
      warnings.push(...result.warnings);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Recursively traverse directory entries and collect files
 */
async function traverseEntry(
  entry: FileSystemEntry,
  basePath: string,
  onProgress?: ProgressCallback
): Promise<FileWithPath[]> {
  const results: FileWithPath[] = [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;

    // Get the file
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    // Calculate relative path
    const relativePath = basePath ? `${basePath}/${file.name}` : file.name;

    // Skip hidden files if configured
    if (!INCLUDE_HIDDEN_FILES && isHiddenFile(file.name)) {
      return results;
    }

    // Only include allowed extensions
    if (isAllowedExtension(file.name)) {
      results.push({ file, relativePath });

      if (onProgress) {
        const totalBytes = results.reduce((sum, { file }) => sum + file.size, 0);
        onProgress(results.length, totalBytes);
      }
    }
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;

    // Skip hidden directories if configured
    if (!INCLUDE_HIDDEN_FILES && isHiddenFile(dirEntry.name)) {
      return results;
    }

    const dirReader = dirEntry.createReader();

    // Read all entries in the directory
    let entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];

    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });
      entries = entries.concat(batch);
    } while (batch.length > 0);

    // Recursively process each entry
    const newBasePath = basePath ? `${basePath}/${dirEntry.name}` : dirEntry.name;

    for (const childEntry of entries) {
      const childResults = await traverseEntry(childEntry, newBasePath, onProgress);
      results.push(...childResults);
    }
  }

  return results;
}

/**
 * Process dropped items using FileSystem API
 */
export async function processDroppedItems(
  items: DataTransferItemList,
  onProgress?: ProgressCallback
): Promise<FileWithPath[]> {
  const results: FileWithPath[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind !== 'file') continue;

    // Get entry (try both standard and webkit versions)
    const itemWithEntry = item as DataTransferItem & {
      getAsEntry?: () => FileSystemEntry | null;
      webkitGetAsEntry?: () => FileSystemEntry | null;
    };
    const entry = itemWithEntry.getAsEntry?.() || itemWithEntry.webkitGetAsEntry?.();

    if (!entry) {
      // Fallback to regular file if entry not supported
      const file = item.getAsFile();
      if (file && isAllowedExtension(file.name)) {
        if (!INCLUDE_HIDDEN_FILES && isHiddenFile(file.name)) {
          continue;
        }
        results.push({ file, relativePath: file.name });
      }
      continue;
    }

    const entryResults = await traverseEntry(entry, '', onProgress);
    results.push(...entryResults);
  }

  return results;
}

/**
 * Process files from folder picker input
 */
export function processFileInput(
  fileList: FileList,
  onProgress?: ProgressCallback
): FileWithPath[] {
  const results: FileWithPath[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    // Skip hidden files if configured
    if (!INCLUDE_HIDDEN_FILES && isHiddenFile(file.name)) {
      continue;
    }

    // Only include allowed extensions
    if (!isAllowedExtension(file.name)) {
      continue;
    }

    // Get relative path from webkitRelativePath
    const fileWithPath = file as File & { webkitRelativePath?: string };
    const relativePath = fileWithPath.webkitRelativePath || file.name;

    results.push({ file, relativePath });

    if (onProgress) {
      const totalBytes = results.reduce((sum, { file }) => sum + file.size, 0);
      onProgress(results.length, totalBytes);
    }
  }

  return results;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create FormData with all files
 */
export function createFormData(
  files: FileWithPath[],
  metadata?: {
    uploaderEmail?: string;
    shootName?: string;
    notes?: string;
  }
): FormData {
  const formData = new FormData();

  // Append all files with their relative paths as the filename
  for (const { file, relativePath } of files) {
    formData.append('files[]', file, relativePath);
  }

  // Append metadata as JSON string
  if (metadata) {
    formData.append('meta', JSON.stringify(metadata));
  }

  return formData;
}
