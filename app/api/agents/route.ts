import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { KV_PREFIXES } from '../../../src/types/kv-schema';
import type { Agent } from '../../../src/types/kv-schema';
import { getRequestContext } from '@cloudflare/next-on-pages';

type RouteParams = { params: { id?: string } };

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// Helper function to handle common error responses
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: status === 500 ? 'Internal server error' : message },
    { status }
  );
}

// GET /api/agents - List all agents for a user
async function handleGET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return handleError(null, 'User ID is required', 400);
    }

    const agents = await kv.listAgentsByUser(userId);
    return NextResponse.json(agents);
  } catch (error) {
    return handleError(error, 'Failed to list agents');
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = await request.json();
    
    if (!agentData.name || !agentData.role || !agentData.personality) {
      return handleError(null, 'Missing required fields', 400);
    }

    const agent: Agent = {
      ...agentData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.setAgent(agent);
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to create agent');
  }
}

// PATCH /api/agents/:id - Update an agent
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!params?.id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const updates = await request.json() as Partial<Agent>;
    const updatedAgent = await kv.updateAgent(params.id, {
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
// DELETE /api/agents/:id - Delete an agent
export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = context.params;
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


