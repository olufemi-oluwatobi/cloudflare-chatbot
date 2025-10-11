import { NextResponse } from 'next/server';
import { KVStore } from '../../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// GET /api/knowledge-packs/[id] - Get a specific knowledge pack
async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { id } = await params;
    
    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Knowledge pack ID and user ID are required' },
        { status: 400 }
      );
    }

    const packs = await kv.listKnowledgePackIndexes(userId);
    const pack = packs.find((p: { id: string }) => p.id === id);
    
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

// DELETE /api/knowledge-packs/[id] - Delete a knowledge pack
async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { id } = await params;
    
    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Knowledge pack ID and user ID are required' },
        { status: 400 }
      );
    }

    await kv.removeKnowledgePackIndex(id, userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting knowledge pack:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge pack' },
      { status: 500 }
    );
  }
}

export { GET, DELETE };
