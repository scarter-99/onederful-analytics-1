# Folder Upload for n8n Webhook Integration

> Production-ready folder upload system that preserves subfolder structure and forwards files directly to n8n webhooks.

## Features

✅ **Folder Upload with Structure Preservation** - Upload entire folders while maintaining subfolder hierarchy
✅ **Single Request** - All files sent in one HTTP request to n8n
✅ **Drag & Drop** - Modern drag-and-drop interface + folder selection
✅ **Real-time Progress** - Per-file upload progress with visual indicators
✅ **Security** - Rate limiting, authentication, input validation, security headers
✅ **Retry Logic** - Automatic retry with exponential backoff for n8n webhook failures
✅ **TypeScript** - Fully typed with comprehensive error handling
✅ **Production Ready** - Optimized for Vercel deployment with 2 GB upload support

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- n8n instance with webhook URL
- Vercel account (optional, for deployment)

### 2. Installation

```bash
# Clone or navigate to project
cd onederful-analytics-1

# Install dependencies (already done if using existing project)
npm install

# Copy environment template
cp .env.folder-upload.example .env.local
```

### 3. Configuration

Edit `.env.local`:

```env
# REQUIRED
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/folder-upload
N8N_HOOK_SECRET=your-secret-key-min-32-chars
CLIENT_ID=my_studio

# OPTIONAL (has defaults)
MAX_FILE_SIZE=50MB
MAX_TOTAL_SIZE=2GB
MAX_FILE_COUNT=1000
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000/folder-upload

### 5. Deploy to Vercel

```bash
# Push to Git
git add .
git commit -m "Add folder upload system"
git push

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard
# Or use CLI:
vercel env add N8N_WEBHOOK_URL
vercel env add N8N_HOOK_SECRET
vercel env add CLIENT_ID
```

---

## Project Structure

```
app/
├── folder-upload/
│   └── page.tsx              # Upload UI with drag-drop
├── api/
    └── folder-upload/
        └── route.ts          # API endpoint

lib/
└── folder-upload/
    ├── config.ts             # Environment configuration
    ├── validation.ts         # Input validation utilities
    ├── rate-limit.ts         # Rate limiting
    └── n8n-forwarder.ts      # n8n webhook integration

types/
└── folder-upload.ts          # TypeScript type definitions

PRD_FOLDER_UPLOAD.md          # Full Product Requirements Document
.env.folder-upload.example    # Environment variable template
```

---

## Usage

### Upload Interface

1. **Select Folder:**
   - Drag & drop folder onto upload area
   - OR click "Choose Folder" button
   - Browser will show folder picker

2. **Review Files:**
   - See file count, total size, folder structure
   - Optionally add metadata (email, shoot name, notes)

3. **Upload:**
   - Click "Upload X Files"
   - Watch real-time progress
   - Receive confirmation with Job ID

### Programmatic Upload

```typescript
const formData = new FormData();

// Add files with relative paths
files.forEach((file) => {
  formData.append('files[]', file, file.webkitRelativePath);
});

// Add metadata
formData.append('meta', JSON.stringify({
  uploaderEmail: 'user@example.com',
  shootName: 'Wedding 2025',
  notes: 'Priority processing',
}));

// Upload
const response = await fetch('/api/folder-upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

---

## n8n Integration

### Webhook Setup

1. **Create Webhook Node in n8n:**
   - Method: POST
   - Path: /folder-upload (or custom)
   - Response Mode: "When Last Node Finishes"
   - Binary Data: Yes

2. **Verify Headers:**
   - `x-hook-secret` - matches N8N_HOOK_SECRET
   - `x-client-id` - client identifier
   - `x-file-total-count` - number of files
   - `x-file-total-bytes` - total size in bytes
   - `x-batch-id` - unique batch identifier

### Process Files in n8n

**Function Node - Extract Files:**

```javascript
// Parse all uploaded files
const files = [];

for (const key of Object.keys($binary)) {
  if (key.startsWith('files[')) {
    const file = $binary[key];
    files.push({
      filename: file.fileName,        // Full relative path
      mimeType: file.mimeType,
      data: file.data,
      size: file.data.length,
      folder: file.fileName.split('/').slice(0, -1).join('/'),
      basename: file.fileName.split('/').pop(),
    });
  }
}

// Group by folder
const byFolder = {};
files.forEach(file => {
  if (!byFolder[file.folder]) {
    byFolder[file.folder] = [];
  }
  byFolder[file.folder].push(file);
});

return {
  json: {
    totalFiles: files.length,
    folders: Object.keys(byFolder),
    filesByFolder: byFolder,
    metadata: $input.first().json.meta,
  },
  binary: $binary,
};
```

**Example Workflow:**

```
[Webhook] → [Function: Parse] → [Switch: By Folder]
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
              [RAW Processing]   [JPEG Processing]  [Other]
                    ↓                 ↓                 ↓
              [Upload to S3]    [Thumbnails]     [Archive]
                    └─────────────────┴─────────────────┘
                                      ↓
                              [Notification Email]
```

---

## Configuration Reference

### Upload Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | 50MB | Maximum size per file |
| `MAX_TOTAL_SIZE` | 2GB | Maximum total upload |
| `MAX_FILE_COUNT` | 1000 | Maximum files per upload |

### File Types

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_EXTENSIONS` | `.jpg,.jpeg,.png,.webp,.tif,.tiff,.raw,.cr2,.nef,.arw,.dng` | Allowed file extensions |
| `ALLOWED_MIME_TYPES` | `image/jpeg,image/png,image/webp,image/tiff` | Allowed MIME types |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | false | Enable basic auth |
| `AUTH_USERNAME` | - | Username (if enabled) |
| `AUTH_PASSWORD` | - | Password (if enabled) |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | true | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | 300000 | 5 minutes |
| `RATE_LIMIT_MAX_REQUESTS` | 30 | Max requests per window |

### n8n Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_WEBHOOK_URL` | - | n8n webhook URL (required) |
| `N8N_HOOK_SECRET` | - | Authentication secret (required) |
| `N8N_RETRY_ATTEMPTS` | 2 | Number of retries |
| `N8N_RETRY_BACKOFF` | 500,1500 | Retry delays (ms) |
| `N8N_TIMEOUT` | 60000 | Request timeout (ms) |

---

## Security

### Built-in Security Features

✅ **Input Validation:**
- File type whitelist
- Size limits enforced
- Path traversal prevention
- MIME type verification

✅ **Rate Limiting:**
- 30 requests per 5 minutes per IP
- In-memory store (use Upstash Redis for production scale)

✅ **Security Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)
- Referrer-Policy
- Permissions-Policy

✅ **Authentication (Optional):**
- Basic HTTP authentication
- Configurable via environment

✅ **n8n Protection:**
- Secret header verification
- Timeout protection
- Retry with backoff
- Error handling

### Best Practices

1. **Always use HTTPS** in production
2. **Set strong N8N_HOOK_SECRET** (min 32 characters)
3. **Enable AUTH if publicly exposed**
4. **Monitor rate limit logs**
5. **Review n8n webhook logs regularly**

---

## Error Handling

### Client-Side Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "File type not allowed" | Wrong extension | Check ALLOWED_EXTENSIONS |
| "File too large" | Exceeds MAX_FILE_SIZE | Reduce file size |
| "Total size exceeds limit" | Exceeds MAX_TOTAL_SIZE | Upload fewer files |
| "Too many files" | Exceeds MAX_FILE_COUNT | Split into batches |

### Server-Side Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | VALIDATION_FAILED | Invalid input | Check file types/sizes |
| 401 | UNAUTHORIZED | Auth failed | Check credentials |
| 413 | PAYLOAD_TOO_LARGE | Too large | Reduce upload size |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests | Wait 5 minutes |
| 502 | WEBHOOK_FAILED | n8n error | Check n8n logs |
| 500 | INTERNAL_ERROR | Server error | Check server logs |

---

## Testing

### Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3000/folder-upload

# 3. Test scenarios:
- Upload folder with nested structure
- Upload folder at size limit
- Upload invalid file types
- Test rate limiting (30+ uploads)
- Test with n8n webhook down
```

### API Testing

```bash
# Test upload endpoint directly
curl -X POST http://localhost:3000/api/folder-upload \
  -F 'files[]=@image1.jpg;filename=folder/subfolder/image1.jpg' \
  -F 'files[]=@image2.jpg;filename=folder/image2.jpg' \
  -F 'meta={"shootName":"Test Upload"}'
```

### n8n Testing

```bash
# Test n8n webhook directly
curl -X POST https://your-n8n.app.n8n.cloud/webhook/folder-upload \
  -H "x-hook-secret: your-secret" \
  -H "x-client-id: test" \
  -H "x-file-total-count: 1" \
  -H "x-file-total-bytes: 1024" \
  -F 'files[]=@test.jpg;filename=test/test.jpg' \
  -F 'meta={"test": true}'
```

---

## Troubleshooting

### "N8N_WEBHOOK_URL not configured"

**Cause:** Missing environment variable

**Solution:**
```bash
# Add to .env.local
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/folder-upload
```

### "n8n webhook failed after retries"

**Causes:**
- n8n instance down
- Webhook URL incorrect
- Secret mismatch
- Timeout (large upload)

**Solutions:**
1. Verify n8n is running
2. Check webhook URL in n8n
3. Verify N8N_HOOK_SECRET matches
4. Increase N8N_TIMEOUT for large uploads

### "Browser doesn't support folder upload"

**Cause:** Using Firefox or old browser

**Solution:**
- Use Chrome, Edge, or Safari
- OR manually zip folder before upload

### Rate limit reached

**Cause:** Too many uploads in 5 minutes

**Solution:**
- Wait 5 minutes
- OR increase RATE_LIMIT_MAX_REQUESTS
- OR disable with RATE_LIMIT_ENABLED=false

---

## Performance

### Upload Speed

| Size | Expected Time (100 Mbps) |
|------|--------------------------|
| 100 MB | ~10 seconds |
| 500 MB | ~45 seconds |
| 1 GB | ~90 seconds |
| 2 GB | ~180 seconds |

### Optimization Tips

1. **Use faster internet connection**
2. **Upload during off-peak hours**
3. **Split large folders into batches**
4. **Compress images before upload** (optional)
5. **Use wired connection** (not WiFi)

---

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Safari | 15+ | ✅ Full support |
| Firefox | Any | ⚠️ No folder upload (use ZIP) |

---

## Per-Client Deployment

### Deploy for Each Client

```bash
# 1. Clone repository
git clone <your-repo>
cd onederful-analytics-1

# 2. Create new Vercel project
vercel link

# 3. Set environment variables
vercel env add N8N_WEBHOOK_URL production
vercel env add N8N_HOOK_SECRET production
vercel env add CLIENT_ID production

# 4. Deploy
vercel --prod

# 5. Add custom domain (optional)
vercel domains add upload.clientname.com
```

### Environment Per Client

Each client gets:
- Unique Vercel project
- Own n8n webhook URL
- Own CLIENT_ID
- Optional custom domain
- Isolated rate limits

---

## Monitoring

### Logs

```typescript
// Upload started
[UPLOAD] Received { ip: '1.2.3.4', fileCount: 234, totalSize: 1887436800 }

// n8n forwarding
[N8N] Attempt 1/3 { batchId: 'batch_1699200000_abc123', url: '...' }

// Success
[N8N] Success { batchId: '...', status: 200, executionId: 'n8n_exec_xyz', attempt: 1 }

// Upload complete
[UPLOAD] Success { fileCount: 234, n8nStatus: 200, durationMs: 45000 }
```

### Metrics to Track

- Upload success rate
- Average upload duration
- n8n retry rate
- Rate limit hits
- File type distribution
- Total bandwidth used

---

## FAQ

### Q: Can I upload ZIP files?

**A:** Not in V1. ZIP files are disabled to prevent zip bomb attacks. Upload folders directly.

### Q: What happens if upload fails midway?

**A:** The entire upload is atomic. Either all files succeed or none do. No partial uploads.

### Q: Can I resume interrupted uploads?

**A:** Not in V1. This is planned for V2. Currently, restart the upload.

### Q: How do I increase upload size limit?

**A:** Edit `MAX_TOTAL_SIZE` in .env.local. Vercel Pro supports up to 4.5 GB.

### Q: Can I use S3 instead of n8n?

**A:** Planned for V2. Currently only supports direct n8n webhook.

### Q: Does it work with other workflow tools?

**A:** Yes! Any webhook that accepts multipart/form-data works. Just set N8N_WEBHOOK_URL.

---

## Roadmap

### V2 (Planned)

- [ ] S3 upload option (upload to S3, send URLs to n8n)
- [ ] Chunked upload for large files
- [ ] Resume interrupted uploads
- [ ] ZIP file support with bomb detection
- [ ] Progress callback webhooks
- [ ] Admin dashboard
- [ ] Upload history
- [ ] Multi-language support

---

## Support

- **Documentation:** See [PRD_FOLDER_UPLOAD.md](./PRD_FOLDER_UPLOAD.md)
- **n8n Docs:** https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- **Issues:** Create GitHub issue

---

## License

See main project LICENSE file.

---

**Built with ❤️ for n8n automation workflows**
