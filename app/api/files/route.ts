import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { KVStore } from '../../../src/lib/kv-helpers';
import type { FileMetadata } from '../../../src/types/kv-schema';

export const runtime = 'edge';

// Helper function to handle errors
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: message, details: error instanceof Error ? error.message : String(error) },
    { status }
  );
}

// GET /api/files - List all files for a user
async function handleGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');
    
    if (!userId) {
      return handleError(new Error('User ID is required'), 'Missing user ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);

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
async function handlePOST(request: Request) {
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
    const fileMetadata = {
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
    };
    
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    await kvStore.setFile(fileMetadata);

    // If conversationId is provided, associate the file with the conversation
    if (conversationId) {
      await kvStore.addFileToConversation(fileMetadata.id, conversationId);
    }

    return NextResponse.json({ success: true, file: fileMetadata });
  } catch (error) {
    return handleError(error, 'Failed to upload file');
  }
}

// DELETE /api/files/:id - Delete a file
async function handleDELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    
    if (!id) {
      return handleError(new Error('File ID is required'), 'Missing file ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    
    // Get file metadata first
    const file = await kvStore.getFile(id);
    if (!file) {
      return handleError(new Error('File not found'), 'File not found', 404);
    }

    // Remove from R2 storage
    await env.FILE_STORAGE.delete(file.r2Key);
    
    // Remove from KV
    await kvStore.deleteFile(id);
    
    // If conversationId is provided, remove the file from the conversation
    if (conversationId) {
      await kvStore.removeFileFromConversation(id, conversationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, 'Failed to delete file');
  }
}

// PATCH /api/files/:id - Update file metadata
async function handlePATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const updates = await request.json();
    
    if (!id) {
      return handleError(new Error('File ID is required'), 'Missing file ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    
    // Update file metadata
    const updateData = {
      ...(updates as Partial<FileMetadata>),
      updatedAt: new Date().toISOString()
    };
    const updatedFile = await kvStore.updateFileMetadata(id, updateData);
    
    if (!updatedFile) {
      return handleError(new Error('File not found'), 'File not found', 404);
    }

    return NextResponse.json({ success: true, file: updatedFile });
  } catch (error) {
    return handleError(error, 'Failed to update file');
  }
}

// SEARCH /api/files/search - Search files
async function handleSearch(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId');
    
    if (!query) {
      return handleError(new Error('Search query is required'), 'Missing search query', 400);
    }
    if (!userId) {
      return handleError(new Error('User ID is required'), 'Missing user ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    
    const results = await kvStore.searchFiles(query, userId);
    
    return NextResponse.json({ results });
  } catch (error) {
    return handleError(error, 'Search failed');
  }
}

// Handle different HTTP methods
async function handleRequest(request: Request, { params = { id: '' } }: { params?: { id: string } } = {}) {
  switch (request.method) {
    case 'GET': {
      const { searchParams } = new URL(request.url);
      return searchParams.has('q') ? handleSearch(request) : handleGET(request);
    }
    case 'POST':
      return handlePOST(request);
    case 'DELETE':
      return handleDELETE(request, { params });
    case 'PATCH':
      return handlePATCH(request, { params });
    default:
      return new NextResponse('Method not allowed', { status: 405 });
  }
}

// Export the handler functions
export const GET = handleRequest;
export const POST = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const PUT = handleRequest;
