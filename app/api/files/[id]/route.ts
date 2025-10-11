import { NextResponse } from 'next/server';
import { KVStore } from '../../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { FileMetadata } from '../../../../src/types/kv-schema';

export const runtime = 'edge';

// Helper function to handle errors
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: message, details: error instanceof Error ? error.message : String(error) },
    { status }
  );
}

// GET /api/files/[id] - Get a specific file
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(new Error('File ID is required'), 'Missing file ID', 400);
    }

    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    
    // Get file metadata
    const file = await kvStore.getFile(id);
    if (!file) {
      return handleError(new Error('File not found'), 'File not found', 404);
    }

    return NextResponse.json(file);
  } catch (error) {
    return handleError(error, 'Failed to get file');
  }
}

// PATCH /api/files/[id] - Update file metadata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(new Error('File ID is required'), 'Missing file ID', 400);
    }

    const updates = await request.json() as Partial<FileMetadata>;
    const env = getRequestContext().env;
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    
    // Update file metadata
    const updateData = {
      ...updates,
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

// DELETE /api/files/[id] - Delete a file
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, 'Failed to delete file');
  }
}
