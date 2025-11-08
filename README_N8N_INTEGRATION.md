# Folder Upload to n8n Webhook

Production-ready Next.js application for uploading entire photo folders directly to n8n webhooks for automated processing.

## Features

- **True Folder Drag-and-Drop**: Supports recursive folder enumeration with nested path preservation
- **Direct n8n Integration**: Forwards multipart form data directly to n8n webhook (no intermediate storage)
- **Security First**: Rate limiting, optional Basic Auth, path sanitization, size validation
- **Progress Tracking**: Real-time file discovery and upload progress
- **Browser Compatibility**: Full support for Chrome/Edge/Safari, fallback for Firefox
- **Retry Logic**: Automatic retries with exponential backoff for n8n webhook failures
- **Production Ready**: TypeScript, tests, comprehensive error handling

## Architecture

```
User Browser
    ↓ Drag/drop folder or select via input
Frontend (React)
    ↓ Enumerate files, validate, build FormData
    ↓ POST /api/folder-upload
API Route (Next.js)
    ↓ Auth check, rate limit, re-validate
    ↓ Forward multipart to n8n with headers
n8n Webhook
    ↓ Receive files[], start workflow
    ↓ Return { executionId }
```

### Key Design Decisions

1. **No Intermediate Storage**: Files go directly from browser → API → n8n (no S3/Blob)
2. **Single Request**: All files sent in one POST for atomic uploads
3. **Path Preservation**: Relative paths stored as filenames in FormData
4. **Security Layers**: Client validation + server re-validation + auth + rate limiting

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/folder-upload
N8N_HOOK_SECRET=your-secure-secret-here
CLIENT_ID=your-client-id

# Optional (shown with defaults)
MAX_FILE_SIZE=524288000       # 500 MB
MAX_TOTAL_SIZE=2147483648     # 2 GB
MAX_FILE_COUNT=20000
```

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 4. Test with a Folder

1. Drag a folder onto the drop zone OR click "Select Folder"
2. Fill optional metadata (email, shoot name, notes)
3. Click "Upload X files"
4. Check n8n for execution

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_WEBHOOK_URL` | Your n8n webhook endpoint URL | `https://n8n.example.com/webhook/upload` |
| `N8N_HOOK_SECRET` | Secret for webhook authentication | `random-secure-string-here` |
| `CLIENT_ID` | Unique identifier for this client | `client-abc-123` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `BASIC_AUTH_USERNAME` | _none_ | Enable Basic Auth for API (leave empty to disable) |
| `BASIC_AUTH_PASSWORD` | _none_ | Password for Basic Auth |
| `MAX_FILE_SIZE` | `524288000` | Max size per file (500 MB) |
| `MAX_TOTAL_SIZE` | `2147483648` | Max total upload size (2 GB) |
| `MAX_FILE_COUNT` | `20000` | Max number of files per upload |
| `ALLOWED_EXTENSIONS` | `jpg,jpeg,png,...` | Comma-separated allowed extensions |
| `RATE_LIMIT_MAX` | `30` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `300000` | Rate limit window (5 min in ms) |
| `N8N_TIMEOUT` | `60000` | Webhook request timeout (60s in ms) |
| `N8N_RETRY_ATTEMPTS` | `2` | Number of retry attempts |
| `N8N_RETRY_BACKOFF` | `1000,2000,4000` | Retry backoff delays (ms) |

## n8n Workflow Setup

### 1. Create Webhook Trigger

1. In n8n, add a **Webhook** node
2. Set HTTP Method: `POST`
3. Set Path: `/folder-upload` (or your choice)
4. Enable **Binary Data**: Yes
5. Add **Authentication** header check (recommended):
   - Header Name: `x-hook-secret`
   - Header Value: Match your `N8N_HOOK_SECRET`

### 2. Extract Files with Function Node

Add a **Function** node after webhook to explode files:

```javascript
const out = [];
const bin = items[0].binary || {};
const metadata = JSON.parse(items[0].json.body?.meta || '{}');

for (const [key, binaryData] of Object.entries(bin)) {
  if (!key.startsWith('files[]')) continue;
  
  const relativePath = String(binaryData.fileName || '');
  
  out.push({
    json: {
      relativePath,
      shootName: metadata.shootName,
      uploaderEmail: metadata.uploaderEmail,
      notes: metadata.notes,
      uploadTimestamp: metadata.uploadTimestamp,
    },
    binary: {
      file: binaryData,
    },
  });
}

return out;
```

### 3. Process Files

After the Function node, you'll have one item per file. Now you can:

- **Split In Batches**: Process files in chunks
- **Process Image**: Resize, convert, add watermark
- **Upload to Storage**: S3, Google Drive, etc.
- **Use {{$json.relativePath}}**: Preserve folder structure in destination

### 4. Merge and Notify

- **Merge** results from all files
- **Archive** (optional): Create ZIP
- **Send Email/Slack**: Notify client with download link

### Headers Sent to n8n

| Header | Description | Example |
|--------|-------------|---------|
| `x-hook-secret` | Authentication secret | `your-secret` |
| `x-client-id` | Client identifier | `client-abc-123` |
| `x-file-total-count` | Total number of files | `1250` |
| `x-file-total-bytes` | Total upload size in bytes | `1073741824` |
| `x-batch-id` | Unique batch identifier | `batch-20241108-abc123` |
| `x-meta-sha256` | SHA-256 hash of metadata JSON | `a3f5...` |

## File Structure

```
/
├── app/
│   ├── page.tsx                      # Main upload UI
│   └── api/
│       └── folder-upload/
│           └── route.ts              # API endpoint
├── lib/
│   ├── folder-drop.ts                # Client-side folder utilities
│   ├── security.ts                   # Security utilities
│   ├── folder-upload/
│   │   ├── config.ts                 # Configuration
│   │   ├── validation.ts             # Server validation
│   │   ├── rate-limit.ts             # Rate limiting
│   │   └── n8n-forwarder.ts         # n8n webhook client
│   └── __tests__/
│       └── security.test.ts          # Unit tests
├── types/
│   └── folder-upload.ts              # TypeScript types
├── .env.example                      # Environment template
├── PRD_N8N_INTEGRATION.md           # Product requirements
└── README_N8N_INTEGRATION.md        # This file
```

## API Endpoint

### POST /api/folder-upload

Upload a folder's worth of files to n8n webhook.

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `files[]`: Multiple file entries (one per file)
    - Each file's `filename` is the relative path from folder root
  - `meta`: JSON string with metadata

**Example with curl:**

```bash
curl -X POST http://localhost:3000/api/folder-upload \
  -F "files[]=@IMG_001.jpg;filename=wedding/RAW/IMG_001.CR2" \
  -F "files[]=@IMG_002.jpg;filename=wedding/JPEG/IMG_001.jpg" \
  -F "meta={\"shootName\":\"Test\",\"uploaderEmail\":\"test@example.com\"}"
```

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Upload successful. Files sent to n8n.",
  "jobId": "exec-20241108-abc123",
  "filesProcessed": 1250,
  "totalBytes": 1073741824,
  "n8nResponse": {
    "status": "accepted",
    "executionId": "exec-20241108-abc123"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation failed (invalid file types, size limits, etc.)
- `401 Unauthorized`: Basic Auth required and credentials invalid
- `429 Too Many Requests`: Rate limit exceeded
- `502 Bad Gateway`: n8n webhook failed after retries
- `500 Internal Server Error`: Unexpected error

## Security

### Rate Limiting

- **Default**: 30 requests per 5 minutes per IP
- **Storage**: In-memory Map (single instance)
- **Production**: Migrate to Redis for multi-instance deployments

### Basic Authentication

Optional. If `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` are set:

```bash
curl -u username:password http://localhost:3000/api/folder-upload
```

Frontend will prompt for credentials if enabled.

### Path Sanitization

All file paths are sanitized to prevent:
- Parent directory traversal (`../`)
- Absolute paths (`/etc/passwd`)
- Null bytes (`\0`)
- Special characters (`<>?*|`)

### Validation

**Client-side** (fast feedback):
- File extension check
- Per-file size check
- Total size check
- File count check

**Server-side** (security):
- Re-validate everything from client
- Path sanitization
- MIME type check (when possible)

### Headers

All responses include security headers:
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`

## Testing

### Run Unit Tests

```bash
npm test
```

### Manual Testing

Use the test matrix from [PRD_N8N_INTEGRATION.md](./PRD_N8N_INTEGRATION.md):

- ✓ Deep folder nesting (10+ levels)
- ✓ Many small files (10,000 × 1KB)
- ✓ Single large file (400MB RAW)
- ✓ Mixed extensions (JPG, PNG, CR2, NEF)
- ✗ Invalid extensions (should reject .exe)
- ✗ Over size limit (should reject)
- ✗ Cancel mid-upload (should abort)

## Browser Support

### Tier 1: Full Support
- **Chrome 80+**
- **Edge 80+**
- **Safari 14+**

Features: Drag-and-drop folders, folder picker

### Tier 2: Partial Support
- **Firefox 90+**

Features: Folder picker only (drag-drop shows warning)

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

```bash
git push origin main
vercel --prod
```

### Other Platforms

Works on any Node.js 18+ hosting:
- AWS Lambda (via Serverless Next.js)
- Google Cloud Run
- Railway
- Render
- Self-hosted Docker

## Troubleshooting

### Files not appearing in n8n

**Check:**
1. n8n webhook URL is correct and accessible
2. `x-hook-secret` header matches n8n authentication
3. n8n workflow is activated
4. Check n8n execution logs for errors

### Upload fails with 502 Bad Gateway

**Possible causes:**
1. n8n webhook is down or slow
2. Network timeout (default 60s)
3. n8n rejected request (check auth)

**Solutions:**
- Increase `N8N_TIMEOUT`
- Check n8n logs
- Test webhook with curl:

```bash
curl -X POST https://your-n8n.com/webhook/upload \
  -H "x-hook-secret: your-secret" \
  -F "test=true"
```

### Rate limit errors

**Solutions:**
- Increase `RATE_LIMIT_MAX`
- Increase `RATE_LIMIT_WINDOW`
- For multi-instance, implement Redis rate limiting

### Out of memory errors

**Causes:**
- Very large uploads (multi-GB)
- Many concurrent uploads

**Solutions:**
- Reduce `MAX_TOTAL_SIZE`
- Increase Node.js heap: `NODE_OPTIONS="--max-old-space-size=4096"`
- Consider chunked upload (V2 feature)

## Roadmap (V2+)

### Planned Features

1. **Direct S3 Upload**: Use presigned URLs to avoid proxying large files
2. **Job Status Tracking**: Poll for processing status by jobId
3. **Resume Failed Uploads**: Chunk files and resume from last chunk
4. **Client Dashboard**: View upload history, track processing
5. **Redis Rate Limiting**: Distributed rate limiting for multi-instance
6. **Audit Logs**: Track all uploads for compliance
7. **Admin Panel**: Monitor system health, manage clients

See [PRD_N8N_INTEGRATION.md](./PRD_N8N_INTEGRATION.md) for full roadmap.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Submit a pull request

## License

MIT

## Support

For issues or questions:
- GitHub Issues: [Your repo URL]
- Email: [Your email]
- Documentation: [This README]
