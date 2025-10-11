import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// GET /api/knowledge-packs - List all knowledge pack indexes for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (query) {
      // Handle search
      const results = await kv.searchKnowledgePackIndexes(query, userId);
      return NextResponse.json(results);
    }

    // Regular listing
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
export async function POST(request: Request) {
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

