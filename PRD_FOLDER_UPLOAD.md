# PRD: Folder Upload System for n8n Webhook Integration

**Version:** 1.0
**Date:** 2025-11-06
**Status:** Ready for Implementation

---

## 1. Problem Statement

Photography studios and creative agencies need to upload large collections of images (wedding shoots, product photography, etc.) while preserving the original folder structure for processing in n8n workflows. Current solutions require:
- Manual zipping/unzipping (slow, error-prone)
- Multiple individual uploads (loses folder context)
- Complex FTP setups (poor UX)

**Goal:** Enable one-click folder upload that preserves subfolder structure and sends all files to n8n in a single webhook execution.

---

## 2. User Roles

### 2.1 Anonymous Uploader
- Drag-and-drop or select folders via browser
- Provide optional metadata (email, shoot name, notes)
- Receive upload confirmation
- **No account required**

### 2.2 Client Owner (Studio/Agency)
- Deploys their own instance on Vercel
- Configures n8n webhook URL via environment variables
- Sets upload limits and allowed file types
- Manages their own n8n workflows

### 2.3 Admin/Developer (Optional Future)
- Monitors upload logs
- Adjusts rate limits
- Updates configuration

---

## 3. Scope

### 3.1 In Scope (V1)
✅ Folder upload with subfolder preservation
✅ Client-side validation (file types, size)
✅ Server-side validation (comprehensive)
✅ Single HTTP request containing all files
✅ Direct forwarding to n8n webhook
✅ Retry logic with exponential backoff
✅ Rate limiting per IP
✅ Security headers and HTTPS
✅ Per-client deployment via env vars
✅ Progress indicators
✅ Error handling and user feedback

### 3.2 Out of Scope (V1)
❌ Database storage
❌ S3/cloud storage (add in V2)
❌ Authentication system
❌ Admin dashboard
❌ ZIP file handling
❌ Image processing/thumbnails
❌ Multi-language support
❌ Mobile app

---

## 4. User Experience

### 4.1 Upload Flow

```
┌─────────────────────────────────────────┐
│  Folder Upload for n8n Processing      │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │
│  │   📁 Drag folder here           │  │
│  │   or click to browse            │  │
│  │                                 │  │
│  │   [Choose Folder]               │  │
│  │                                 │  │
│  └─────────────────────────────────┘  │
│                                         │
│  Optional Information:                  │
│  ┌─────────────────────────────────┐  │
│  │ Email (optional)                │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Shoot Name (optional)           │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Notes (optional)                │  │
│  └─────────────────────────────────┘  │
│                                         │
│  [ Upload Folder ]                      │
└─────────────────────────────────────────┘

After Selection:
┌─────────────────────────────────────────┐
│  Folder: wedding-2025-11-05             │
│  Files: 234 images (1.8 GB)             │
│                                         │
│  Structure Preview:                      │
│  📁 wedding-2025-11-05/                 │
│    📁 RAW/                              │
│       📄 IMG_0001.CR2 (25 MB)          │
│       📄 IMG_0002.CR2 (26 MB)          │
│    📁 JPEG/                             │
│       📄 DSC_0001.jpg (8 MB)           │
│    📄 _metadata.txt                     │
│                                         │
│  [████████████░░░░] 75% Uploading...   │
│  Sending to n8n webhook...              │
└─────────────────────────────────────────┘

Success:
┌─────────────────────────────────────────┐
│  ✅ Upload Complete!                    │
│                                         │
│  234 files uploaded successfully        │
│  n8n workflow triggered                 │
│  Job ID: batch_1699200000_abc123       │
│                                         │
│  [Upload Another Folder]                │
└─────────────────────────────────────────┘
```

### 4.2 Browser Compatibility

**Supported (Full Features):**
- Chrome/Edge 90+ (webkitdirectory)
- Safari 15+ (webkitdirectory)

**Fallback (Firefox):**
- Show manual instructions to zip folder
- Provide guidance: "Firefox doesn't support folder upload. Please use Chrome/Safari or zip your folder first."

### 4.3 File Selection

**HTML5 Folder Input:**
```html
<input
  type="file"
  webkitdirectory
  multiple
  accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.raw,.cr2,.nef,.arw"
/>
```

**Drag & Drop:**
- Detect folder drop via DataTransfer
- Use File System Access API (Chrome) or fallback to webkitdirectory

---

## 5. File Handling

### 5.1 Accepted File Types (Configurable)

**Default:**
- `.jpg`, `.jpeg` - JPEG images
- `.png` - PNG images
- `.webp` - WebP images
- `.tif`, `.tiff` - TIFF images
- `.raw`, `.cr2`, `.nef`, `.arw`, `.dng` - RAW camera formats

**Configuration:**
```env
ALLOWED_EXTENSIONS=".jpg,.jpeg,.png,.webp,.tif,.tiff,.raw,.cr2,.nef,.arw"
# or
ALLOWED_MIME_TYPES="image/jpeg,image/png,image/webp,image/tiff"
```

### 5.2 File Size Limits

```env
MAX_FILE_SIZE=50MB          # Per file (default: 50 MB)
MAX_TOTAL_SIZE=2GB          # Total upload (default: 2 GB)
MAX_FILE_COUNT=1000         # Maximum files per upload
```

### 5.3 Path Preservation

**Browser Side:**
```typescript
// file.webkitRelativePath returns:
// "wedding-2025/RAW/IMG_0001.CR2"

// Attach to FormData:
formData.append('files[]', file, file.webkitRelativePath);
```

**Server Side:**
```typescript
// Multer receives:
{
  fieldname: 'files[]',
  originalname: 'wedding-2025/RAW/IMG_0001.CR2',
  mimetype: 'image/x-canon-cr2',
  size: 26214400
}

// Forward to n8n with same filename
```

### 5.4 Validation Rules

**Client-Side (Fast Feedback):**
- File extension whitelist
- Per-file size check
- Total size calculation
- File count limit
- Visual feedback before upload

**Server-Side (Security):**
- Re-validate all client checks
- MIME type verification (magic bytes)
- Path traversal prevention (`../` detection)
- Filename sanitization
- Rate limiting enforcement

---

## 6. API Contract

### 6.1 Upload Endpoint

**Request:**
```http
POST /api/upload HTTP/1.1
Host: your-app.vercel.app
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
Content-Length: 1887436800

------WebKitFormBoundary
Content-Disposition: form-data; name="files[]"; filename="wedding/RAW/IMG_0001.CR2"
Content-Type: image/x-canon-cr2

[binary data]
------WebKitFormBoundary
Content-Disposition: form-data; name="files[]"; filename="wedding/JPEG/DSC_0001.jpg"
Content-Type: image/jpeg

[binary data]
------WebKitFormBoundary
Content-Disposition: form-data; name="meta"

{"uploaderEmail":"client@example.com","shootName":"Wedding 2025","notes":"Priority rush"}
------WebKitFormBoundary--
```

**TypeScript Type:**
```typescript
interface UploadMetadata {
  clientId?: string;
  uploaderEmail?: string;
  shootName?: string;
  notes?: string;
  uploadTimestamp?: string;
}

interface UploadRequest {
  files: File[];  // with webkitRelativePath preserved
  meta?: UploadMetadata;
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Upload successful. Files sent to n8n.",
  "jobId": "batch_1699200000_abc123",
  "filesProcessed": 234,
  "totalBytes": 1887436800,
  "n8nResponse": {
    "status": "accepted",
    "executionId": "n8n_exec_xyz789"
  }
}
```

**Error Responses:**

```json
// 400 - Validation Error
{
  "ok": false,
  "error": "VALIDATION_FAILED",
  "message": "Total size exceeds 2 GB limit",
  "details": {
    "totalSize": 2147483648,
    "maxSize": 2000000000
  }
}

// 413 - Payload Too Large
{
  "ok": false,
  "error": "PAYLOAD_TOO_LARGE",
  "message": "Upload exceeds 2 GB limit"
}

// 429 - Rate Limit
{
  "ok": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many uploads. Try again in 5 minutes.",
  "retryAfter": 300
}

// 500 - Server Error
{
  "ok": false,
  "error": "INTERNAL_ERROR",
  "message": "Failed to process upload"
}

// 502 - n8n Error
{
  "ok": false,
  "error": "WEBHOOK_FAILED",
  "message": "n8n webhook rejected the upload",
  "details": {
    "status": 502,
    "retries": 3
  }
}
```

---

## 7. n8n Integration

### 7.1 Webhook Configuration

**n8n Webhook Node Setup:**
- **HTTP Method:** POST
- **Path:** `/webhook/folder-upload` (or custom)
- **Response Mode:** "When Last Node Finishes"
- **Response Data:** "First Entry JSON"
- **Binary Data:** Yes - store as files[]

**Expected Headers:**
```typescript
{
  'x-hook-secret': string;      // Authentication
  'x-client-id': string;        // Client identifier
  'x-file-total-count': string; // "234"
  'x-file-total-bytes': string; // "1887436800"
  'x-batch-id': string;         // "batch_1699200000_abc123"
  'x-meta-sha256': string;      // Checksum of meta JSON
  'content-type': 'multipart/form-data'
}
```

### 7.2 Forwarding Logic

**Our Server → n8n:**
```typescript
// Retry configuration
const retries = 2;
const backoff = [500, 1500]; // ms
const timeout = 60000; // 60 seconds

// Forward request
const response = await fetch(N8N_WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'x-hook-secret': N8N_HOOK_SECRET,
    'x-client-id': CLIENT_ID,
    'x-file-total-count': files.length.toString(),
    'x-file-total-bytes': totalBytes.toString(),
    'x-batch-id': generateBatchId(),
    'x-meta-sha256': hashMeta(meta),
  },
  body: formData, // Same multipart with files[]
  timeout,
});

// Retry on 5xx or ECONNRESET
if (!response.ok && shouldRetry(response.status)) {
  await delay(backoff[attempt]);
  // Retry...
}
```

### 7.3 n8n Processing Example

**Function Node - Extract Files with Paths:**
```javascript
// n8n Function Node
const files = [];

// Iterate over all binary data
for (const key of Object.keys($binary)) {
  if (key.startsWith('files[')) {
    const file = $binary[key];
    files.push({
      filename: file.fileName, // Contains full relative path
      mimeType: file.mimeType,
      data: file.data,         // Base64 or buffer
      size: file.data.length,
      // Parse folder structure
      folder: file.fileName.split('/').slice(0, -1).join('/'),
      basename: file.fileName.split('/').pop(),
    });
  }
}

// Group by folder
const folders = {};
files.forEach(file => {
  if (!folders[file.folder]) {
    folders[file.folder] = [];
  }
  folders[file.folder].push(file);
});

return {
  json: {
    totalFiles: files.length,
    folders: Object.keys(folders),
    filesByFolder: folders,
    metadata: $input.first().json.meta,
  },
  binary: $binary,
};
```

**Example Workflow:**
```
[Webhook] → [Function: Parse Folders] → [Switch: By Folder Type]
                                              ↓
                        ┌─────────────────────┼─────────────────────┐
                        ↓                     ↓                     ↓
                [RAW Processing]    [JPEG Processing]     [Other Files]
                        ↓                     ↓                     ↓
                [Upload to S3]      [Generate Thumbnails]  [Archive]
                        ↓                     ↓                     ↓
                        └─────────────────────┼─────────────────────┘
                                              ↓
                                    [Send Email Notification]
```

---

## 8. Security

### 8.1 Authentication

**Option 1: None (Public Upload)**
```env
# No auth - anyone can upload
AUTH_ENABLED=false
```

**Option 2: Basic Auth**
```env
AUTH_ENABLED=true
AUTH_USERNAME=studio_upload
AUTH_PASSWORD=secure_random_password_here
```

**Implementation:**
```typescript
// Middleware
if (process.env.AUTH_ENABLED === 'true') {
  const auth = request.headers.get('authorization');
  const [username, password] = decodeBasicAuth(auth);

  if (username !== process.env.AUTH_USERNAME ||
      password !== process.env.AUTH_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

### 8.2 Rate Limiting

**Per IP:**
```typescript
// 30 requests per 5 minutes per IP
const rateLimit = {
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many uploads, please try again later',
};
```

**Implementation:**
```typescript
// In-memory store (or use Upstash Redis for serverless)
const ipStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipStore.get(ip);

  if (!record || now > record.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + 300000 });
    return true;
  }

  if (record.count >= 30) {
    return false;
  }

  record.count++;
  return true;
}
```

### 8.3 Input Validation

**Path Traversal Prevention:**
```typescript
function sanitizePath(path: string): string {
  // Remove dangerous patterns
  const sanitized = path
    .replace(/\.\./g, '')      // No parent directory
    .replace(/^\/+/, '')       // No absolute paths
    .replace(/\/+/g, '/')      // Normalize slashes
    .replace(/[<>:"|?*]/g, ''); // Remove invalid chars

  return sanitized;
}
```

**MIME Type Verification:**
```typescript
import { fileTypeFromBuffer } from 'file-type';

async function verifyMimeType(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const type = await fileTypeFromBuffer(buffer);

  // Check magic bytes match extension
  return ALLOWED_MIME_TYPES.includes(type?.mime);
}
```

### 8.4 Security Headers

**Next.js Config:**
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  },
];
```

### 8.5 Forbidden Practices

❌ **Never:**
- Store files locally on serverless (ephemeral)
- Trust client-provided MIME types
- Allow arbitrary file uploads without validation
- Log sensitive data (passwords, secrets)
- Expose n8n webhook URL to client
- Skip rate limiting
- Allow path traversal patterns
- Accept ZIP files in V1 (zip bomb risk)

---

## 9. Environment Variables

### 9.1 Required

```env
# n8n Webhook Configuration
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/folder-upload
N8N_HOOK_SECRET=your-secret-key-min-32-chars

# Client Identifier
CLIENT_ID=studio_acme_photo

# App Configuration
NEXT_PUBLIC_APP_NAME="Acme Photo Studio Upload"
NEXT_PUBLIC_APP_URL=https://upload.acmephoto.com
```

### 9.2 Optional

```env
# Upload Limits
MAX_FILE_SIZE=52428800              # 50 MB (bytes)
MAX_TOTAL_SIZE=2147483648           # 2 GB (bytes)
MAX_FILE_COUNT=1000

# File Type Restrictions
ALLOWED_EXTENSIONS=".jpg,.jpeg,.png,.webp,.tif,.tiff,.raw,.cr2,.nef,.arw"
ALLOWED_MIME_TYPES="image/jpeg,image/png,image/webp,image/tiff"

# Authentication
AUTH_ENABLED=false
AUTH_USERNAME=upload_user
AUTH_PASSWORD=secure_password_here

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=300000         # 5 minutes
RATE_LIMIT_MAX_REQUESTS=30

# Retry Configuration
N8N_RETRY_ATTEMPTS=2
N8N_RETRY_BACKOFF=500,1500          # Milliseconds
N8N_TIMEOUT=60000                    # 60 seconds

# Feature Flags
ENABLE_CHECKSUM_VALIDATION=true
ENABLE_MIME_TYPE_VERIFICATION=true
ENABLE_PROGRESS_CALLBACK=false

# Logging
LOG_LEVEL=info                       # debug, info, warn, error
LOG_UPLOADS=true
LOG_N8N_RESPONSES=false             # Don't log sensitive data
```

### 9.3 Development

```env
# .env.local (development)
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
N8N_WEBHOOK_URL=https://your-test-n8n.cloud/webhook-test/folder-upload
```

---

## 10. Deployment

### 10.1 Vercel Configuration

**vercel.json:**
```json
{
  "name": "folder-upload-n8n",
  "version": 2,
  "regions": ["iad1"],
  "env": {
    "N8N_WEBHOOK_URL": "@n8n-webhook-url",
    "N8N_HOOK_SECRET": "@n8n-hook-secret",
    "CLIENT_ID": "@client-id"
  },
  "functions": {
    "app/api/upload/route.ts": {
      "maxDuration": 60,
      "memory": 3008
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000"
        }
      ]
    }
  ]
}
```

### 10.2 Per-Client Deployment

**Repository Structure:**
```
folder-upload-template/
├── app/
├── lib/
├── public/
├── .env.example
├── vercel.json
└── README.md

Deployment per client:
1. Fork or clone repository
2. Create new Vercel project
3. Set environment variables
4. Deploy
```

**Automated:**
```bash
# Deploy script
#!/bin/bash
CLIENT_ID=$1
N8N_WEBHOOK=$2

vercel --prod \
  -e N8N_WEBHOOK_URL="$N8N_WEBHOOK" \
  -e CLIENT_ID="$CLIENT_ID" \
  -e N8N_HOOK_SECRET="$(openssl rand -hex 32)"
```

### 10.3 Custom Domain

```bash
# Add custom domain per client
vercel domains add upload.clientname.com --project=folder-upload-clientname
```

---

## 11. Performance

### 11.1 Upload Optimization

**Chunking (Future V2):**
- Split large uploads into chunks
- Upload chunks in parallel
- Reassemble on server or in n8n

**Compression:**
- Client-side image compression (optional)
- Configure NEXT_PUBLIC_ENABLE_COMPRESSION=true

**Progress Tracking:**
```typescript
// XMLHttpRequest for progress
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  const percent = (e.loaded / e.total) * 100;
  updateProgressBar(percent);
});
```

### 11.2 Server Optimization

**Streaming:**
```typescript
// Stream files to n8n without loading all into memory
import { pipeline } from 'stream/promises';

await pipeline(
  request.body,
  n8nRequest
);
```

**Timeout Management:**
- Client timeout: 120 seconds
- Server timeout: 60 seconds
- n8n timeout: 60 seconds

---

## 12. Monitoring & Logging

### 12.1 Metrics to Track

```typescript
interface UploadMetrics {
  timestamp: string;
  clientId: string;
  fileCount: number;
  totalBytes: number;
  uploadDurationMs: number;
  n8nDurationMs: number;
  success: boolean;
  errorType?: string;
  retryCount: number;
}
```

### 12.2 Logging

**Console Logs (Development):**
```typescript
console.log('[UPLOAD]', {
  batchId,
  fileCount,
  totalBytes: formatBytes(totalBytes),
  clientId,
});

console.log('[N8N]', {
  status: response.status,
  executionId: response.data.executionId,
  duration: `${duration}ms`,
});
```

**Production Logging:**
```typescript
// Use Vercel Analytics or external service
import { track } from '@vercel/analytics';

track('upload_complete', {
  fileCount,
  totalBytes,
  clientId,
});
```

---

## 13. Testing

### 13.1 Manual Test Cases

**Happy Path:**
- [x] Upload folder with 10 JPEGs
- [x] Upload folder with nested structure (3 levels deep)
- [x] Upload folder with mixed file types (RAW + JPEG)
- [x] Verify n8n receives all files
- [x] Verify folder structure preserved

**Edge Cases:**
- [x] Upload exactly at size limit (2 GB)
- [x] Upload with special characters in filenames
- [x] Upload with very long paths (>260 chars)
- [x] Upload empty folder (should fail gracefully)
- [x] Upload single file (should work)

**Error Cases:**
- [x] Upload exceeding size limit
- [x] Upload disallowed file type
- [x] Upload while n8n is down (test retry)
- [x] Upload with malformed metadata
- [x] Hit rate limit (30+ uploads)

### 13.2 Automated Tests

```typescript
describe('/api/upload', () => {
  it('accepts valid folder upload', async () => {
    const formData = createMockFolderUpload();
    const response = await POST('/api/upload', formData);
    expect(response.status).toBe(200);
    expect(response.json.filesProcessed).toBe(10);
  });

  it('rejects files exceeding size limit', async () => {
    const formData = createLargeUpload(3_000_000_000); // 3 GB
    const response = await POST('/api/upload', formData);
    expect(response.status).toBe(413);
  });

  it('retries on n8n 5xx errors', async () => {
    mockN8nResponse({ status: 502 });
    const response = await POST('/api/upload', formData);
    expect(n8nCallCount).toBe(3); // 1 initial + 2 retries
  });
});
```

---

## 14. Error Handling

### 14.1 Client-Side

```typescript
try {
  const response = await uploadFolder(files, metadata);
  showSuccess('Upload complete!');
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    showError('Too many uploads. Please wait 5 minutes.');
  } else if (error.code === 'PAYLOAD_TOO_LARGE') {
    showError('Folder is too large. Max 2 GB.');
  } else {
    showError('Upload failed. Please try again.');
  }
}
```

### 14.2 Server-Side

```typescript
// Error types
class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

class N8nError extends Error {
  constructor(message: string, public status: number, public retries: number) {
    super(message);
    this.name = 'N8nError';
  }
}

// Error handler
export function handleError(error: Error): Response {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { ok: false, error: 'VALIDATION_FAILED', message: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMIT_EXCEEDED', retryAfter: error.retryAfter },
      { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
    );
  }

  if (error instanceof N8nError) {
    return NextResponse.json(
      { ok: false, error: 'WEBHOOK_FAILED', message: error.message },
      { status: 502 }
    );
  }

  // Generic error
  console.error('[ERROR]', error);
  return NextResponse.json(
    { ok: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    { status: 500 }
  );
}
```

---

## 15. Future Enhancements (V2)

### 15.1 S3 Storage
- Upload to S3 first
- Send S3 URLs to n8n instead of file data
- Reduces n8n payload size
- Enables async processing

### 15.2 Chunked Upload
- Split large folders into chunks
- Upload chunks in parallel
- Show individual chunk progress

### 15.3 Resume Support
- Save upload state
- Resume interrupted uploads
- Client-side persistence

### 15.4 Admin Dashboard
- View upload history
- Monitor success rates
- Configure settings via UI

### 15.5 Advanced Features
- ZIP file support (with bomb detection)
- Image preview/thumbnails
- Duplicate detection
- Metadata extraction (EXIF)

---

## 16. Success Criteria

### 16.1 MVP Complete When:
- [x] User can drag-drop folder
- [x] All files upload in single request
- [x] Folder structure preserved
- [x] n8n receives all files correctly
- [x] Rate limiting works
- [x] Security headers present
- [x] Error handling graceful
- [x] Deployed on Vercel
- [x] Documentation complete

### 16.2 Production Ready When:
- [x] All tests passing
- [x] Performance acceptable (< 60s for 2 GB)
- [x] Error rate < 1%
- [x] Client can deploy independently
- [x] n8n integration verified

---

## 17. Documentation Deliverables

### 17.1 For Developers
- README.md (setup, deployment)
- API.md (endpoint specs)
- ARCHITECTURE.md (system design)
- CONTRIBUTING.md (for template users)

### 17.2 For Clients
- DEPLOYMENT_GUIDE.md (Vercel setup)
- N8N_SETUP.md (webhook configuration)
- TROUBLESHOOTING.md (common issues)

### 17.3 For End Users
- FAQ.md (user questions)
- Browser requirements
- File type guidance

---

## 18. Appendix

### 18.1 Browser API Reference

**File System Access API:**
```typescript
// Modern Chrome/Edge
const dirHandle = await window.showDirectoryPicker();
for await (const entry of dirHandle.values()) {
  // Process files
}
```

**webkitdirectory (Fallback):**
```typescript
<input type="file" webkitdirectory multiple />
```

### 18.2 n8n Binary Data Format

```typescript
// n8n stores files as:
{
  data: Buffer | string,  // Base64 or binary
  mimeType: string,
  fileName: string,       // Full relative path
  fileExtension: string,
  fileSize: number,
}
```

### 18.3 FormData Structure

```typescript
// Client sends:
formData.append('files[]', file, file.webkitRelativePath);
// Results in filename: "folder/subfolder/image.jpg"

// n8n receives:
$binary['files[0]'].fileName === "folder/subfolder/image.jpg"
```

---

## Document Metadata

**Version History:**
- v1.0 (2025-11-06): Initial PRD

**Stakeholders:**
- Product Owner: [Name]
- Technical Lead: [Name]
- n8n Integration: [Name]

**References:**
- [MDN: File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [n8n Webhook Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Vercel Limits](https://vercel.com/docs/concepts/limits/overview)

**Status:** ✅ Ready for Implementation
