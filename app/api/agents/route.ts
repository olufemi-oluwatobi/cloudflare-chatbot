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
async function handleGET(request: Request) {
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
async function handlePOST(request: Request) {
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

// GET /api/agents/:id - Get a specific agent
async function handleGETById(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const agent = await kv.getAgent(params.id);
    if (!agent) {
      return handleError(null, 'Agent not found', 404);
    }

    return NextResponse.json(agent);
  } catch (error) {
    return handleError(error, 'Failed to get agent');
  }
}

// PATCH /api/agents/:id - Update an agent
async function handlePATCH(request: Request, { params }: RouteParams) {
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
async function handleDELETE(request: Request, { params }: RouteParams) {
  try {
    if (!params?.id) {
      return handleError(null, 'Agent ID is required', 400);
    }

    const success = await kv.deleteAgent(params.id);
    if (!success) {
      return handleError(null, 'Agent not found', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, 'Failed to delete agent');
  }
}

// Search agents
async function handleSearch(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId');
    
    if (!query) {
      return handleError(null, 'Search query is required', 400);
    }
    
    if (!userId) {
      return handleError(null, 'User ID is required', 400);
    }

    const agents = await kv.searchAgents(query, userId);
    return NextResponse.json(agents);
  } catch (error) {
    return handleError(error, 'Failed to search agents');
  }
}

// GET /api/agents - List all agents or search
// GET /api/agents/:id - Get a specific agent
export async function GET(
  request: Request,
  { params }: { params: { id?: string } } = { params: {} }
) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get('q');
  
  // Handle GET /api/agents/:id
  if (params?.id) {
    return handleGETById(request, { params });
  }
  
  // Handle GET /api/agents?q=search
  if (searchQuery) {
    return handleSearch(request);
  }
  
  // Handle GET /api/agents
  return handleGET(request);
}

// POST /api/agents - Create a new agent
export async function POST(request: Request) {
  return handlePOST(request);
}

// PATCH /api/agents/:id - Update an agent
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params?.id) {
    return handleError(null, 'Agent ID is required', 400);
  }
  return handlePATCH(request, { params });
}

// DELETE /api/agents/:id - Delete an agent
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params?.id) {
    return handleError(null, 'Agent ID is required', 400);
  }
  return handleDELETE(request, { params });
}

// SEARCH /api/agents/search - Search agents (alternative to using query params)
export async function SEARCH(request: Request) {
  return handleSearch(request);
}
