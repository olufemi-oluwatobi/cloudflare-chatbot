import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { KV_PREFIXES } from '../../../src/types/kv-schema';
import type { Agent } from '../../../src/types/kv-schema';
import {getRequestContext} from '@cloudflare/next-on-pages';
type RouteParams = { params: { id?: string } };

// Initialize KV store
const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);

// GET /api/agents - List all agents for a user
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

    const agents = await kv.listAgentsByUser(userId);
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: 'Failed to list agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
async function handlePOST(request: Request) {
  try {
    const agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = await request.json();
    
    if (!agentData.name || !agentData.role || !agentData.personality) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

// GET /api/agents/:id - Get a specific agent
async function handleGETById(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const agent = await kv.getAgent(params.id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error getting agent:', error);
    return NextResponse.json(
      { error: 'Failed to get agent' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/:id - Update an agent
async function handlePATCH(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const updates = await request.json() as Partial<Agent>;
    const updatedAgent = await kv.updateAgent(params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/:id - Delete an agent
async function handleDELETE(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const success = await kv.deleteAgent(params.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}

// Search agents
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

    const agents = await kv.searchAgents(query, userId);
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error searching agents:', error);
    return NextResponse.json(
      { error: 'Failed to search agents' },
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
