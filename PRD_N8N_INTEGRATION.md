# PRD: Folder Upload to n8n Webhook

## Problem Statement

Photography clients need to upload entire photo shoot folders (containing thousands of images in nested directories) to trigger automated post-processing workflows. Current solutions require:
- Manual file-by-file uploads
- Zip compression/decompression cycles
- Complex multi-step interfaces
- Loss of folder structure information

This creates friction and delays in the photo processing pipeline.

## Solution

A single-page web application that allows users to drag-and-drop or select entire folders, which are then uploaded in one HTTP request to an n8n webhook that orchestrates the photo processing workflow.

## Scope

### In Scope (V1)
- Single-request folder upload with preserved nested paths
- Client-side folder enumeration and validation
- Direct multipart forwarding to n8n webhook (no intermediate storage)
- Progress tracking and upload cancellation
- Security: rate limiting, auth headers, size limits
- Browser compatibility detection and fallback
- Basic error handling and user feedback

### Out of Scope (V2+ Roadmap)
- Database for tracking upload history
- S3 or blob storage intermediate layer
- Status dashboard for monitoring jobs
- Multi-client authentication system
- Resume/retry failed uploads
- Client-side image preview/thumbnails
- Admin dashboard for analytics
- Audit logs and compliance features

## User Roles

### 1. Uploader (Anonymous/Authenticated)
**Goals:**
- Upload photo shoot folder quickly
- See upload progress
- Get confirmation of successful upload
- Provide metadata (email, shoot name, notes)

**Permissions:**
- Can upload folders
- Cannot view others' uploads
- Cannot access admin features

### 2. Client Owner (V2)
**Goals:**
- View their upload history
- Track processing status
- Manage team members
- Configure upload settings

**Permissions:**
- Full access to their data
- Invite/remove team members
- Configure client-specific settings

### 3. Admin (Us)
**Goals:**
- Monitor system health
- Configure global settings
- Troubleshoot issues
- Manage client accounts

**Permissions:**
- Full system access
- View all uploads
- Configure environment variables
- Access logs and metrics

## Environment Variables

```bash
# Required
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/folder-upload
N8N_HOOK_SECRET=your-secure-secret-here
CLIENT_ID=client-unique-id

# Optional
BASIC_AUTH_USERNAME=client123
BASIC_AUTH_PASSWORD=secure_password
MAX_FILE_SIZE=524288000  # 500 MB in bytes
MAX_TOTAL_SIZE=2147483648  # 2 GB in bytes
MAX_FILE_COUNT=20000
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,tif,tiff,cr2,nef,arw,raf,orf,rw2
RATE_LIMIT_MAX=30
RATE_LIMIT_WINDOW=300000  # 5 minutes in ms
```

## Success Metrics

### V1
- ✓ Upload success rate > 95%
- ✓ Average upload time < 2 minutes for 1000 files
- ✓ Zero security incidents
- ✓ Browser compatibility warnings shown correctly
- ✓ All tests passing
