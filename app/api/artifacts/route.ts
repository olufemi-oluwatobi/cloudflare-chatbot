import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import type { Artifact } from '../../../src/types/kv-schema';
import {getRequestContext} from '@cloudflare/next-on-pages';
type RouteParams = { params: { id?: string } };

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// GET /api/artifacts - List all artifacts for a user
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

    const artifacts = await kv.listArtifactsByUser(userId);
    return NextResponse.json(artifacts);
  } catch (error) {
    console.error('Error listing artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to list artifacts' },
      { status: 500 }
    );
  }
}

// POST /api/artifacts - Create a new artifact
async function handlePOST(request: Request) {
  try {
    const artifactData = await request.json() as Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>;
    
    if (!artifactData.title || !artifactData.type || !artifactData.content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const artifact: Artifact = {
      ...artifactData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.setArtifact(artifact);
    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    console.error('Error creating artifact:', error);
    return NextResponse.json(
      { error: 'Failed to create artifact' },
      { status: 500 }
    );
  }
}

// GET /api/artifacts/:id - Get a specific artifact
async function handleGETById(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Artifact ID is required' },
        { status: 400 }
      );
    }

    const artifact = await kv.getArtifact(params.id);
    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(artifact);
  } catch (error) {
    console.error('Error getting artifact:', error);
    return NextResponse.json(
      { error: 'Failed to get artifact' },
      { status: 500 }
    );
  }
}

// PATCH /api/artifacts/:id - Update an artifact
async function handlePATCH(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Artifact ID is required' },
        { status: 400 }
      );
    }

    const updates = await request.json() as Partial<Artifact>;
    const updatedArtifact = await kv.updateArtifact(params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedArtifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedArtifact);
  } catch (error) {
    console.error('Error updating artifact:', error);
    return NextResponse.json(
      { error: 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

// DELETE /api/artifacts/:id - Delete an artifact
async function handleDELETE(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Artifact ID is required' },
        { status: 400 }
      );
    }

    const success = await kv.deleteArtifact(params.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return NextResponse.json(
      { error: 'Failed to delete artifact' },
      { status: 500 }
    );
  }
}

// Search artifacts
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

    const artifacts = await kv.searchArtifacts(query, userId);
    return NextResponse.json(artifacts);
  } catch (error) {
    console.error('Error searching artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to search artifacts' },
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
