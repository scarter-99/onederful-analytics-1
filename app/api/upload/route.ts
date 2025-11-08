import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

// Allowed MIME types for photo formats
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-fuji-raf',
  'image/x-olympus-orf',
  'image/x-panasonic-rw2',
];

// Allowed extensions (fallback when MIME type is not recognized)
const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff',
  'cr2', 'nef', 'arw', 'raf', 'orf', 'rw2'
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_FILES = 20000;

interface UploadedFile {
  relativePath: string;
  url: string;
  size: number;
  mimeType: string;
}

interface Metadata {
  uploaderEmail?: string;
  shootName?: string;
  notes?: string;
}

function isAllowedFile(file: File): boolean {
  // Check MIME type first
  if (ALLOWED_TYPES.includes(file.type)) {
    return true;
  }

  // Fallback to extension check
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract files
    const fileEntries = formData.getAll('files[]');

    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate file count
    if (fileEntries.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES} allowed.` },
        { status: 400 }
      );
    }

    // Extract metadata
    const metaString = formData.get('meta') as string | null;
    let metadata: Metadata = {};

    if (metaString) {
      try {
        metadata = JSON.parse(metaString);
      } catch (e) {
        console.error('Failed to parse metadata:', e);
      }
    }

    // Process and validate files
    const files: { file: File; relativePath: string }[] = [];
    let totalSize = 0;

    for (const entry of fileEntries) {
      if (!(entry instanceof File)) continue;

      const file = entry as File;

      // Validate file type
      if (!isAllowedFile(file)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.name}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
          },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Max 500 MB per file.` },
          { status: 400 }
        );
      }

      totalSize += file.size;

      // The relative path is stored in the filename when using FormData.append with 3 params
      const relativePath = file.name;

      files.push({ file, relativePath });
    }

    // Validate total size
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: 'Total upload size exceeds 2 GB limit' },
        { status: 400 }
      );
    }

    // Upload all files to Vercel Blob
    const uploadedFiles: UploadedFile[] = [];

    for (const { file, relativePath } of files) {
      try {
        // Upload with the relative path preserved in the blob name
        const blob = await put(relativePath, file, {
          access: 'public',
        });

        uploadedFiles.push({
          relativePath,
          url: blob.url,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        });
      } catch (uploadError) {
        console.error(`Failed to upload ${relativePath}:`, uploadError);
        return NextResponse.json(
          { error: `Failed to upload ${relativePath}` },
          { status: 500 }
        );
      }
    }

    // Trigger n8n webhook with all files
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'folder_uploaded',
            timestamp: new Date().toISOString(),
            metadata,
            files: uploadedFiles,
            stats: {
              totalFiles: uploadedFiles.length,
              totalSize,
            },
          }),
        });
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        // Don't fail the upload if webhook fails
      }
    }

    return NextResponse.json({
      success: true,
      filesUploaded: uploadedFiles.length,
      totalSize,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
