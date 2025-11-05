# Product Requirements Document: n8n Workflow Testing Platform (MVP)

## 1. Project Overview

### 1.1 Purpose
A simple web application that enables you and your friend to test n8n workflows with AI agents by uploading images and triggering automated workflows via webhooks.

### 1.2 Target Users
- You and your friend (2 users)
- Both need ability to upload images and trigger n8n workflows

---

## 2. MVP Requirements

### 2.1 Must Have (MVP Only)
1. ✅ Image upload functionality (single file)
2. ✅ Image storage (Vercel Blob)
3. ✅ Webhook integration with n8n
4. ✅ Simple, functional UI
5. ✅ Deployed and accessible via URL

### 2.2 Explicitly Out of Scope for MVP
- Image preview before upload
- Upload history/gallery
- Authentication
- Multiple file upload
- Error handling beyond basic validation
- Progress indicators
- Image editing
- User management

---

## 3. Technical Stack

**Frontend & Backend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

**Storage:**
- Vercel Blob (recommended - native integration, persistent, no config needed)

**Deployment:**
- Vercel (one-click deployment)

---

## 4. Core Functionality

### 4.1 Image Upload
**Requirements:**
- Accept: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Max file size: 10MB
- Single file upload only
- Simple file input (click to browse)

**Validation:**
- File type validation (server-side)
- File size validation (server-side)

### 4.2 n8n Webhook Integration
**Trigger webhook when image uploads successfully**

**Webhook Payload:**
```json
{
  "event": "image_uploaded",
  "timestamp": "2025-11-05T12:00:00Z",
  "image": {
    "id": "unique-id",
    "filename": "example.jpg",
    "url": "https://blob.vercel-storage.com/xxx",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

### 4.3 User Flow (MVP)
```
1. User opens website
2. User clicks file input to select image
3. User clicks "Upload" button
4. Image uploads to Vercel Blob
5. Webhook triggers to n8n
6. User sees success message "Image uploaded!"
```

---

## 5. Implementation

### 5.1 File Structure
```
/app
  /page.tsx              # Upload page
  /api
    /upload
      /route.ts          # Upload endpoint
/lib
  /webhook.ts            # n8n webhook trigger
```

### 5.2 Upload API (Vercel Blob)

**File: `app/api/upload/route.ts`**
```typescript
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    // Validate
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    });

    // Trigger n8n webhook
    await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'image_uploaded',
        timestamp: new Date().toISOString(),
        image: {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          filename: file.name,
          url: blob.url,
          size: file.size,
          mimeType: file.type,
        },
      }),
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

### 5.3 Upload Page

**File: `app/page.tsx`**
```typescript
'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Image uploaded successfully!');
        setFile(null);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          n8n Workflow Testing
        </h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Max 10MB • JPG, PNG, GIF, WEBP
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>

          {message && (
            <p className={`text-sm text-center ${
              message.includes('Error') ? 'text-red-600' : 'text-green-600'
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Environment Variables

**Required in `.env.local` (local) and Vercel dashboard (production):**

```env
# n8n Webhook URL (required)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id

# Vercel Blob (automatically provided by Vercel)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

---

## 7. Setup & Deployment

### 7.1 Install Dependencies
```bash
npm install @vercel/blob
```

### 7.2 Local Development
1. Create `.env.local` file
2. Add `N8N_WEBHOOK_URL`
3. Get Vercel Blob token:
   ```bash
   npm install -g vercel
   vercel login
   vercel link
   vercel env pull .env.local
   ```
4. Run: `npm run dev`
5. Test at `http://localhost:3000`

### 7.3 n8n Setup
1. Create new workflow in n8n
2. Add "Webhook" trigger node
3. Set HTTP Method to `POST`
4. Copy webhook URL
5. Add to `.env.local` as `N8N_WEBHOOK_URL`

### 7.4 Deploy to Vercel
```bash
# Push to GitHub
git add .
git commit -m "Add image upload functionality"
git push

# Deploy via Vercel dashboard:
# 1. Go to vercel.com
# 2. Import GitHub repository
# 3. Add environment variable: N8N_WEBHOOK_URL
# 4. Deploy
```

**Or using Vercel CLI:**
```bash
vercel --prod
```

---

## 8. Testing Checklist

### 8.1 MVP Success Criteria
- [ ] Website is deployed and accessible via URL
- [ ] Can upload a valid image file
- [ ] Image is stored in Vercel Blob
- [ ] n8n webhook is triggered on upload
- [ ] n8n receives correct payload with image URL
- [ ] n8n can download image from URL
- [ ] Both you and your friend can access and use it

### 8.2 Manual Test
```bash
# Test webhook manually
curl -X POST https://your-n8n-instance.com/webhook/your-id \
  -H "Content-Type: application/json" \
  -d '{
    "event": "image_uploaded",
    "image": {
      "filename": "test.jpg",
      "url": "https://example.com/test.jpg"
    }
  }'
```

---

## 9. n8n Workflow Example

```
[Webhook Trigger]
    ↓ (receives image URL)
[HTTP Request] (GET image from blob URL)
    ↓ (downloads image data)
[AI Agent Node] (process with AI)
    ↓
[Any other processing...]
```

---

## 10. Troubleshooting

**Upload fails:**
- Check file is under 10MB
- Check file type is image
- Check Vercel logs

**Webhook not triggered:**
- Verify `N8N_WEBHOOK_URL` is correct
- Check n8n webhook node is active
- Check Vercel logs for errors

**n8n can't access image:**
- Verify blob URL is public
- Test URL in browser directly

---

## 11. Implementation Timeline

**Total Time: 2-3 hours**

1. **Setup (30 min)**
   - Install `@vercel/blob`
   - Configure environment variables
   - Set up n8n webhook

2. **Build (60 min)**
   - Create upload API route
   - Create upload page UI
   - Test locally

3. **Deploy (30 min)**
   - Push to GitHub
   - Deploy to Vercel
   - Add environment variables
   - Test production

4. **Integration Test (30 min)**
   - Test end-to-end upload → n8n
   - Verify image accessible from n8n
   - Share URL with friend

---

## 12. What's NOT Included (Future)

These can be added later if needed:
- Drag-and-drop upload
- Image preview
- Upload history/gallery
- Progress indicator
- Multiple file upload
- Authentication
- Delete images
- Image editing

---

## Appendix: n8n Webhook Payload Schema

```typescript
{
  "event": "image_uploaded",
  "timestamp": "2025-11-05T12:00:00Z",
  "image": {
    "id": "1699200000-abc123",
    "filename": "photo.jpg",
    "url": "https://blob.vercel-storage.com/xxx",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

---

**Document Version:** MVP 1.0
**Last Updated:** 2025-11-05
**Status:** Ready for Implementation
