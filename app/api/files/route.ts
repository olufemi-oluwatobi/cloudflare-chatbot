import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { KVStore } from '../../../src/lib/kv-helpers';
import type { FileMetadata } from '../../../src/types/kv-schema';

export const runtime = 'edge';

// Helper function to handle errors
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { 
      error: message, 
      details: error instanceof Error ? error.message : String(error) 
    },
    { status }
  );
}

// GET /api/files - List all files for a user or search files
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');
    const query = searchParams.get('q');
    
    if (!userId) {
      return handleError(new Error('User ID is required'), 'Missing user ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);

    // Handle search
    if (query) {
      const results = await kvStore.searchFiles(query, userId);
      return NextResponse.json({ results });
    }

    // Handle list files
    let files;
    if (conversationId) {
      // Get files for a specific conversation
      files = await kvStore.getFilesForConversation(conversationId);
    } else {
      // Get all files for the user
      files = await kvStore.listFilesByUser(userId);
    }

    return NextResponse.json({ files });
  } catch (error) {
    return handleError(error, 'Failed to fetch files');
  }
}

// POST /api/files - Upload a new file
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const conversationId = formData.get('conversationId') as string | null;
    
    if (!file) {
      return handleError(new Error('No file provided'), 'Missing file', 400);
    }
    if (!userId) {
      return handleError(new Error('User ID is required'), 'Missing user ID', 400);
    }

    const env = getRequestContext().env;
    
    // Upload file to R2
    const objectKey = `uploads/${Date.now()}-${file.name}`;
    await env.FILE_STORAGE.put(objectKey, file.stream());

    // Store metadata in KV
    const fileMetadata: FileMetadata = {
      id: crypto.randomUUID(),
      name: file.name,
      type: (file.type.startsWith('image/') ? 'image' : 
            file.type === 'application/pdf' ? 'pdf' : 'document') as 'image' | 'pdf' | 'document',
      storageId: objectKey,
      r2Key: objectKey,
      size: file.size,
      mimeType: file.type,
      uploadedBy: userId,
      conversationId: conversationId || undefined,
      embeddingId: undefined,
      extractedText: undefined,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    await kvStore.setFile(fileMetadata);

    // If conversationId is provided, associate the file with the conversation
    if (conversationId) {
      await kvStore.addFileToConversation(fileMetadata.id, conversationId);
    }

    return NextResponse.json({ success: true, file: fileMetadata }, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to upload file');
  }
}
