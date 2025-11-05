import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_URL not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: JPG, PNG, GIF, WEBP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Convert file to base64 for JSON payload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');

    // Prepare payload for n8n
    const payload = {
      event: 'image_uploaded',
      timestamp: new Date().toISOString(),
      image: {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        data: base64Data, // Send as base64
      },
    };

    // Forward to n8n webhook
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_WEBHOOK_SECRET && {
          'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET,
        }),
      },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send to n8n', details: errorText },
        { status: n8nResponse.status }
      );
    }

    // Parse n8n response
    const n8nData = await n8nResponse.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      n8nResponse: n8nData,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
