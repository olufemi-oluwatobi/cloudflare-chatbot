import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { Artifact } from '../../../src/types/kv-schema';

// Initialize KV store
export const runtime = 'edge';


// Helper function to handle errors
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: status === 500 ? 'Internal server error' : message },
    { status }
  );
}

// GET /api/artifacts - List all artifacts for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    
    if (!userId) {
      return handleError(null, 'User ID is required', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

    // Handle search
    if (query) {
      const artifacts = await kv.searchArtifacts(query, userId);
      return NextResponse.json(artifacts);
    }

    // Handle list all
    const artifacts = await kv.listArtifactsByUser(userId);
    return NextResponse.json(artifacts);
  } catch (error) {
    return handleError(error, 'Failed to list artifacts');
  }
}

// POST /api/artifacts - Create a new artifact
export async function POST(request: Request) {
  try {
    const artifactData = await request.json() as Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>;
    
    if (!artifactData.title || !artifactData.type || !artifactData.content) {
      return handleError(null, 'Missing required fields', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

    const artifact: Artifact = {
      ...artifactData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.setArtifact(artifact);
    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to create artifact');
  }
}
