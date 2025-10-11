import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { KV_PREFIXES } from '../../../src/types/kv-schema';
import { getRequestContext } from '@cloudflare/next-on-pages';

type RouteParams = { params: { id?: string } };

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// GET /api/knowledge-packs - List all knowledge pack indexes for a user
async function handleGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const packs = await kv.listKnowledgePackIndexes(userId);
    return NextResponse.json(packs);
  } catch (error) {
    console.error('Error listing knowledge packs:', error);
    return NextResponse.json(
      { error: 'Failed to list knowledge packs' },
      { status: 500 }
    );
  }
}

// POST /api/knowledge-packs - Create a new knowledge pack index
async function handlePOST(request: Request) {
  try {
    const data = await request.json() as { userId: string; metadata?: Record<string, unknown> };
    const { userId, metadata = {} } = data;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const packId = crypto.randomUUID();
    await kv.indexKnowledgePack(packId, userId, {
      ...metadata,
      status: 'active',
      entryCount: 0,
    });

    return NextResponse.json(
      { id: packId, userId, ...metadata },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating knowledge pack:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge pack' },
      { status: 500 }
    );
  }
}

// GET /api/knowledge-packs/:id - Get a specific knowledge pack's index
async function handleGETById(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!params?.id || !userId) {
      return NextResponse.json(
        { error: 'Knowledge pack ID and user ID are required' },
        { status: 400 }
      );
    }

    const packs = await kv.listKnowledgePackIndexes(userId);
    const pack = packs.find((p: { id: string }) => p.id === params.id);
    
    if (!pack) {
      return NextResponse.json(
        { error: 'Knowledge pack not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(pack);
  } catch (error) {
    console.error('Error getting knowledge pack:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge pack' },
      { status: 500 }
    );
  }
}

// PATCH /api/knowledge-packs/:id - Update a knowledge pack's index
async function handlePATCH(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!params?.id || !userId) {
      return NextResponse.json(
        { error: 'Knowledge pack ID and user ID are required' },
        { status: 400 }
      );
    }

    const updates = await request.json() as Record<string, unknown>;
    
    const packs = await kv.listKnowledgePackIndexes(userId);
    const existingPack = packs.find((p: { id: string }) => p.id === params.id);
    
    if (!existingPack) {
      return NextResponse.json(
        { error: 'Knowledge pack not found' },
        { status: 404 }
      );
    }

    const updatedPack = {
      ...existingPack,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.indexKnowledgePack(params.id, userId, updatedPack);
  } catch (error) {
    console.error('Error updating knowledge pack:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge pack' },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge-packs/:id - Delete a knowledge pack's index
async function handleDELETE(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!params?.id || !userId) {
      return NextResponse.json(
        { error: 'Knowledge pack ID and user ID are required' },
        { status: 400 }
      );
    }

    await kv.removeKnowledgePackIndex(params.id, userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting knowledge pack:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge pack' },
      { status: 500 }
    );
  }
}

// Search knowledge packs
async function handleSearch(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId');

    if (!query || !userId) {
      return NextResponse.json(
        { error: 'Search query and user ID are required' },
        { status: 400 }
      );
    }

    const results = await kv.searchKnowledgePackIndexes(query, userId);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching knowledge packs:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge packs' },
      { status: 500 }
    );
  }
}

// Main request handler
export async function handleRequest(
  request: Request,
  { params = { id: '' } }: { params?: { id?: string } } = {}
) {
  const { searchParams } = new URL(request.url);
  
  // Handle search endpoint
  if (searchParams.has('q')) {
    return handleSearch(request);
  }

  // Route based on HTTP method
  switch (request.method) {
    case 'GET':
      return params.id ? handleGETById(request, { params }) : handleGET(request);
    case 'POST':
      return handlePOST(request);
    case 'PATCH':
      return handlePATCH(request, { params });
    case 'DELETE':
      return handleDELETE(request, { params });
    default:
      return new NextResponse('Method not allowed', { status: 405 });
  }
}

// Export all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
