import { NextResponse } from 'next/server';
import { KVStore } from '../../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { Artifact } from '../../../../src/types/kv-schema';

export const runtime = 'edge';
// Initialize KV store

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

    const artifact = await kv.getArtifact(id);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

    const updates = await request.json() as Partial<Artifact>;
    const updatedArtifact = await kv.updateArtifact(id, {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Artifact ID is required', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

    const success = await kv.deleteArtifact(id);
    if (!success) {
      return handleError(null, 'Artifact not found', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, 'Failed to delete artifact');
  }
}
