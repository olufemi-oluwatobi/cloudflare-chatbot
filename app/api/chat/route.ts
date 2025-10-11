import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest } from 'next/server';
import { Agent, ToolRegistry } from '@/src/lib/Agent';
import { durableObjectTools } from '@/src/tools/durable-object-tools';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const resJson: any = await req.json();
  const messages: any = resJson["messages"];
  const env = getRequestContext().env;

  // Get the last user message
  const lastMessage = messages[messages.length - 1]?.content || '';

  console.log(env.COUNTER.idFromName('A'));

  // Setup tool registry
  const registry = new ToolRegistry();
  
  // Register durable object tools
  const doTools = durableObjectTools(env);
  for (const tool of doTools) {
    registry.register(tool);
  }

  // Create agent
  const agent = new Agent({
    modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    provider: { type: 'workers-ai', binding: env.AI },
    systemPrompt: 'You are a helpful assistant. You can use tools to perform actions. You have durable object tools available. If the user asks you hello, say a proverb and respond appropriately.',
    toolRegistry: registry,
    maxIterations: 10,
    onToolCall: (toolId, params) => {
      console.log(`[Tool Call] ${toolId}:`, params);
    },
    onToolResult: (toolId, result) => {
      console.log(`[Tool Result] ${toolId}:`, result);
    }
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of agent.run(lastMessage)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        console.error('Agent error:', error);
        controller.enqueue(encoder.encode(`\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'content-encoding': 'identity',
      'transfer-encoding': 'chunked',
      'Cache-Control': 'no-cache',
    }
  });
}