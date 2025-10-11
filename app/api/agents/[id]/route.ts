import { NextResponse } from 'next/server';
import { KVStore } from '../../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { Agent } from '../../../../src/types/kv-schema';

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

export const runtime = 'edge';
// Helper function to handle common error responses
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: status === 500 ? 'Internal server error' : message },
    { status }
  );
}

// GET /api/agents/[id] - Get a specific agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const agent = await kv.getAgent(id);
    if (!agent) {
      return handleError(null, 'Agent not found', 404);
    }

    return NextResponse.json(agent);
  } catch (error) {
    return handleError(error, 'Failed to get agent');
  }
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const updates = await request.json() as Partial<Agent>;
    const updatedAgent = await kv.updateAgent(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedAgent) {
      return handleError(null, 'Agent not found', 404);
    }

    return NextResponse.json(updatedAgent);
  } catch (error) {
    return handleError(error, 'Failed to update agent');
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    if (!id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const success = await kv.deleteAgent(id);
    if (!success) {
      return handleError(null, 'Agent not found', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, 'Failed to delete agent');
  }
}
