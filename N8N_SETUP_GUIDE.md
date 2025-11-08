# n8n Webhook Setup Guide

Your folder upload application is now deployed and configured! 

## Current Configuration

**Production URL:** https://onederful-analytics-1-working-8atvdq7dp-sam-s-projects-3fd53907.vercel.app

**n8n Webhook URL:** https://onederful.app.n8n.cloud/webhook-test/f0cd641b-cc30-4dc9-8ee8-f1cc2c365372

**Environment Variables Configured:**
- ✅ N8N_WEBHOOK_URL
- ✅ N8N_HOOK_SECRET (auto-generated secure secret)
- ✅ CLIENT_ID: onederful-client-tyson

## Next Steps: Configure Your n8n Workflow

### 1. Add Header Authentication to n8n Webhook

Currently your n8n webhook has "Authentication: None". You should configure it to accept the secret header:

1. In n8n, click on your Webhook node
2. Go to **Settings** tab
3. Under **Authentication**, select **Header Auth**
4. Set Header Name: `x-hook-secret`
5. For the header value, you need to get the secret from Vercel:

```bash
vercel env pull .env.production
grep N8N_HOOK_SECRET .env.production
```

Or retrieve it via Vercel dashboard.

### 2. Update Binary Data Field Name

Your webhook currently expects binary data in a field called `file`. Our application sends it as `files[]`. Update this in n8n:

1. In the Webhook node parameters
2. Find **Field Name for Binary Data**
3. Change from `file` to `files[]`

### 3. Add Function Node to Process Files

After your webhook, add a **Function** node with this code:

```javascript
// Extract all uploaded files from the multipart request
const out = [];
const bin = items[0].binary || {};
const headers = items[0].json.headers || {};

// Parse metadata from the request
let metadata = {};
try {
  const metaString = items[0].json.body?.meta;
  if (metaString) {
    metadata = JSON.parse(metaString);
  }
} catch (e) {
  console.error('Failed to parse metadata:', e);
}

// Log headers for debugging
console.log('Received headers:', {
  hookSecret: headers['x-hook-secret'] ? 'present' : 'missing',
  clientId: headers['x-client-id'],
  fileCount: headers['x-file-total-count'],
  totalBytes: headers['x-file-total-bytes'],
  batchId: headers['x-batch-id']
});

// Extract each file from the binary data
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
      batchId: headers['x-batch-id'],
      clientId: headers['x-client-id'],
    },
    binary: {
      data: binaryData,
    },
  });
}

console.log(`Processed ${out.length} files`);
return out;
```

### 4. Process Individual Files

After the Function node, you now have one item per file. You can:

**Option A: Process All at Once**
- Add nodes to process each file (resize, compress, etc.)
- Files will be processed in parallel

**Option B: Process in Batches**
- Add **Split In Batches** node (e.g., 10 files at a time)
- Add processing nodes
- More memory-efficient for large uploads

### 5. Example Processing Flow

```
Webhook
  ↓
Function (explode files)
  ↓
Split In Batches (10 at a time)
  ↓
├─ Save to Google Drive (using {{$json.relativePath}})
├─ Resize Image
├─ Add Watermark
  ↓
Merge
  ↓
Send Email Notification (with summary)
```

## Testing the Integration

### Test 1: Simple Upload

1. Visit: https://onederful-analytics-1-working-8atvdq7dp-sam-s-projects-3fd53907.vercel.app
2. Create a small test folder:
   ```bash
   mkdir -p test-upload/subfolder
   echo "test1" > test-upload/file1.jpg
   echo "test2" > test-upload/subfolder/file2.jpg
   ```
3. Drag the `test-upload` folder to the upload zone
4. Fill in optional metadata:
   - Uploader Email: test@example.com
   - Shoot Name: Test Upload
   - Notes: Testing n8n integration
5. Click "Upload 2 files"
6. Check n8n executions

**Expected in n8n:**
- One execution triggered
- Binary data with keys: `files[]_0`, `files[]_1`
- Headers: `x-hook-secret`, `x-client-id`, etc.
- Metadata in request body

### Test 2: Check Headers

In your n8n Function node, add logging to verify headers:

```javascript
console.log('Headers received:', items[0].json.headers);
```

You should see:
```json
{
  "x-hook-secret": "your-secret-here",
  "x-client-id": "onederful-client-tyson",
  "x-file-total-count": "2",
  "x-file-total-bytes": "12345",
  "x-batch-id": "batch-20241108-abc123",
  "x-meta-sha256": "hash-here"
}
```

### Test 3: Verify File Paths

The files should have their relative paths preserved:

```javascript
// In Function node output:
out[0].json.relativePath  // "test-upload/file1.jpg"
out[1].json.relativePath  // "test-upload/subfolder/file2.jpg"
```

## Troubleshooting

### Issue: n8n webhook returns 401 Unauthorized

**Cause:** Header authentication mismatch

**Solution:**
1. Get your N8N_HOOK_SECRET from Vercel
2. Update n8n webhook authentication header value to match

### Issue: Files not appearing in n8n

**Cause:** Binary field name mismatch

**Solution:**
1. In n8n Webhook node, set **Field Name for Binary Data** to `files[]`
2. Ensure webhook HTTP Method is `POST`

### Issue: "No files provided" error

**Cause:** FormData not being parsed correctly

**Solution:**
1. Check n8n webhook accepts `multipart/form-data`
2. Verify binary data option is enabled in webhook

### Issue: Metadata is null/undefined

**Cause:** Metadata not being extracted

**Solution:**
```javascript
// In Function node, parse from body:
const metaString = items[0].json.body?.meta || 
                   items[0].json.meta ||
                   '{}';
const metadata = JSON.parse(metaString);
```

## Security Notes

### Important: Store the Hook Secret

Your `N8N_HOOK_SECRET` is stored encrypted in Vercel. To retrieve it:

```bash
vercel env pull .env.production
cat .env.production | grep N8N_HOOK_SECRET
```

**Save this value** - you'll need it to configure n8n authentication.

### Rate Limiting

The application has rate limiting enabled:
- **Default:** 30 requests per 5 minutes per IP
- **Configurable** via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` env vars

### File Size Limits

Current limits (configurable via env vars):
- Per-file: 500 MB
- Total upload: 2 GB  
- Max files: 20,000

## Getting Help

If you encounter issues:

1. Check Vercel logs:
   ```bash
   vercel logs --prod
   ```

2. Check n8n execution logs in the n8n UI

3. Review the comprehensive docs:
   - [README_N8N_INTEGRATION.md](./README_N8N_INTEGRATION.md)
   - [PRD_N8N_INTEGRATION.md](./PRD_N8N_INTEGRATION.md)

## What's Next?

Your setup is complete! You now have:
- ✅ Folder upload UI with drag-and-drop
- ✅ Direct forwarding to n8n webhook
- ✅ Secure authentication headers
- ✅ Nested path preservation
- ✅ Production deployment

Ready to process photo shoots! 📸
