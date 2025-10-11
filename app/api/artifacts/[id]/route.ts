import { NextResponse } from 'next/server';
import { KVStore } from '../../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { Artifact } from '../../../../src/types/kv-schema';

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// Helper function to handle errors
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: status === 500 ? 'Internal server error' : message },
    { status }
  );
}

// GET /api/artifacts/[id] - Get a specific artifact
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const artifact = await kv.getArtifact(params.id);
    if (!artifact) {
      return handleError(null, 'Artifact not found', 404);
    }

    return NextResponse.json(artifact);
  } catch (error) {
    return handleError(error, 'Failed to get artifact');
  }
}

// PATCH /api/artifacts/[id] - Update an artifact
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const updates = await request.json() as Partial<Artifact>;
    const updatedArtifact = await kv.updateArtifact(params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedArtifact) {
      return handleError(null, 'Artifact not found', 404);
    }

    return NextResponse.json(updatedArtifact);
  } catch (error) {
    return handleError(error, 'Failed to update artifact');
  }
}

// DELETE /api/artifacts/[id] - Delete an artifact
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const success = await kv.deleteArtifact(params.id);
    if (!success) {
      return handleError(null, 'Artifact not found', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, 'Failed to delete artifact');
  }
}
