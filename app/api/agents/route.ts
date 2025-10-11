import { NextResponse } from 'next/server';
import { KVStore } from '../../../src/lib/kv-helpers';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { Agent } from '../../../src/types/kv-schema';

// Initialize KV store
export const runtime = 'edge';


// Helper function to handle common error responses
function handleError(error: unknown, message: string, status = 500) {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { error: status === 500 ? 'Internal server error' : message },
    { status }
  );
}

// GET /api/agents - List all agents for a user
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return handleError(null, 'User ID is required', 400);
    }

    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);


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
    const kv = new KVStore(getRequestContext().env.BREADCRUMB_KV);


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


