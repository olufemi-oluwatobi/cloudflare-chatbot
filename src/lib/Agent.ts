import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createWorkersAI } from 'workers-ai-provider';
import { z } from 'zod';

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export interface ToolDefinition<T extends z.ZodType = z.ZodType<any, any, any>> {
  id: string;
  name: string;
  description: string;
  parameters: T;
  execute: (params: z.infer<T>) => Promise<any> | any;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<T extends z.ZodType>(tool: ToolDefinition<T>): void {
    // Safe to cast since we're just storing the tool with its original type
    this.tools.set(tool.id, tool as unknown as ToolDefinition);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // Convert Zod schema to JSON schema description
  private zodToDescription(schema: z.ZodType): string {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, z.ZodType>;
      const props = Object.entries(shape).map(([key, val]) => {
        let typeDesc = 'unknown';
        let extra = '';
        
        if (val instanceof z.ZodString) {
          typeDesc = 'string';
        } else if (val instanceof z.ZodNumber) {
          typeDesc = 'number';
        } else if (val instanceof z.ZodBoolean) {
          typeDesc = 'boolean';
        } else if (val instanceof z.ZodArray) {
          typeDesc = 'array';
        } else if (val instanceof z.ZodEnum) {
          typeDesc = 'enum';
          extra = ` (options: ${(val as any)._def.values.join(', ')})`;
        } else if (val instanceof z.ZodOptional) {
          typeDesc = 'optional';
        }
        
        const desc = (val as any)._def?.description || '';
        return `    - ${key} (${typeDesc}${extra})${desc ? ': ' + desc : ''}`;
      }).join('\n');
      
      return props;
    }
    return '    (complex schema)';
  }

  // Generate system prompt section describing all available tools
  generateToolPrompt(): string {
    if (this.tools.size === 0) return '';

    const toolDescriptions = Array.from(this.tools.values()).map(tool => {
      const params = this.zodToDescription(tool.parameters);

      return `
### ${tool.name}
**ID:** ${tool.id}
**Description:** ${tool.description}
**Parameters:**
${params}`;
    }).join('\n');

    return `
# Available Tools

You have access to the following tools. To use a tool, respond with a JSON code block in this exact format:

\`\`\`json
{
  "tool": "tool_id_here",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

${toolDescriptions}

# Loop Control

You can end the conversation loop at any time by using the special "finish" tool:

\`\`\`json
{
  "tool": "finish",
  "parameters": {
    "reason": "Task completed successfully"
  }
}
\`\`\`

IMPORTANT: 
- Only use tools when necessary to answer the user's question
- Always respond with the JSON format shown above when calling a tool
- After receiving tool results, you can either call another tool or provide a final answer
- Use the "finish" tool when you've completed the task and want to end the loop
- If you provide a response without any tool calls, the loop will also end naturally
`;
  }
}

// ============================================================================
// PROVIDER SETUP
// ============================================================================

export type ProviderConfig = 
  | { type: 'openai'; apiKey: string }
  | { type: 'anthropic'; apiKey: string }
  | { type: 'workers-ai'; binding: any }
  | { type: 'custom'; provider: any };

export function setupProvider(config: ProviderConfig): any {
  switch (config.type) {
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey });
    case 'workers-ai':
      return createWorkersAI({ binding: config.binding });
    case 'custom':
      return config.provider;
    default:
      throw new Error('Invalid provider configuration');
  }
}

// ============================================================================
// AGENT
// ============================================================================

export interface AgentConfig {
  modelId: string;
  provider: ProviderConfig;
  systemPrompt: string;
  toolRegistry: ToolRegistry;
  maxIterations?: number;
  onToolCall?: (toolId: string, params: any) => void;
  onToolResult?: (toolId: string, result: any) => void;
  onFinish?: (reason: string) => void;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class Agent {
  private config: AgentConfig;
  private messages: Message[] = [];
  private provider: any;
  private shouldStop: boolean = false;

  constructor(config: AgentConfig) {
    this.config = {
      ...config,
      maxIterations: config.maxIterations || 10
    };

    this.provider = setupProvider(config.provider);

    // Register built-in finish tool
    this.registerFinishTool();
  }

  private registerFinishTool(): void {
    const finishTool: ToolDefinition = {
      id: 'finish',
      name: 'Finish',
      description: 'Ends the conversation loop. Use this when you have completed the task.',
      parameters: z.object({
        reason: z.string().describe('The reason for ending the conversation')
      }),
      execute: (params: { reason: string }) => {
        this.shouldStop = true;
        if (this.config.onFinish) {
          this.config.onFinish(params.reason);
        }
        return {
          status: 'finished',
          reason: params.reason
        };
      }
    };

    this.config.toolRegistry.register(finishTool);
  }

  private getSystemPrompt(): string {
    const toolPrompt = this.config.toolRegistry.generateToolPrompt();
    return `${this.config.systemPrompt}\n\n${toolPrompt}`;
  }

  private parseToolCall(content: string): { tool: string; parameters: any } | null {
    try {
      // Look for JSON code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (!codeBlockMatch) return null;

      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (parsed && typeof parsed === 'object' && 'tool' in parsed) {
        return {
          tool: parsed.tool,
          parameters: parsed.parameters || {}
        };
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  async *run(userMessage: string): AsyncGenerator<string> {
    // Reset stop flag
    this.shouldStop = false;

    // Add user message
    this.messages.push({ role: 'user', content: userMessage });

    let iterations = 0;
    const maxIterations = this.config.maxIterations!;

    while (!this.shouldStop && iterations < maxIterations) {
      iterations++;

      // Prepare messages for the model
      const messages = [
        { role: 'system' as const, content: this.getSystemPrompt() },
        ...this.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      ];

      // Stream response from model
      const result = await streamText({
        model: this.provider(this.config.modelId),
        messages
      });

      // Collect the full response while streaming
      let fullContent = '';
      
      for await (const chunk of result.textStream) {
        fullContent += chunk;
        yield chunk;
      }

      // Add assistant message to history
      this.messages.push({ role: 'assistant', content: fullContent });

      // Check if there's a tool call
      const toolCall = this.parseToolCall(fullContent);

      if (!toolCall) {
        // No tool call, natural end of conversation
        break;
      }

      // Execute the tool
      const tool = this.config.toolRegistry.get(toolCall.tool);
      
      if (!tool) {
        const errorMsg = `\n\n[Error: Tool '${toolCall.tool}' not found]`;
        yield errorMsg;
        this.messages.push({
          role: 'user',
          content: `Error: Tool '${toolCall.tool}' not found. Available tools: ${this.config.toolRegistry.getAll().map(t => t.id).join(', ')}`
        });
        continue;
      }

      try {
        // Validate parameters with Zod
        const validatedParams = tool.parameters.parse(toolCall.parameters);
        
        // Callback before execution
        if (this.config.onToolCall) {
          this.config.onToolCall(tool.id, validatedParams);
        }

        // Execute tool
        const toolResult = await tool.execute(validatedParams);
        
        // Callback after execution
        if (this.config.onToolResult) {
          this.config.onToolResult(tool.id, toolResult);
        }

        // Check if we should stop (finish tool sets this)
        if (this.shouldStop) {
          const resultMessage = `\n\n[Finished: ${toolResult.reason || 'Task completed'}]`;
          yield resultMessage;
          break;
        }
        
        // Add tool result as user message (so model can respond to it)
        const resultMessage = `\n\n[Tool Result from ${tool.name}]\n${JSON.stringify(toolResult, null, 2)}`;
        yield resultMessage;
        
        this.messages.push({
          role: 'user',
          content: `Tool '${tool.id}' returned: ${JSON.stringify(toolResult)}`
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMsg = `\n\n[Parameter Validation Error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}]`;
          yield errorMsg;
          
          this.messages.push({
            role: 'user',
            content: `Parameter validation failed for tool '${tool.id}': ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          });
        } else {
          const errorMsg = `\n\n[Tool Execution Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
          yield errorMsg;
          
          this.messages.push({
            role: 'user',
            content: `Error executing tool '${tool.id}': ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }

    if (iterations >= maxIterations && !this.shouldStop) {
      yield '\n\n[Max iterations reached]';
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearHistory(): void {
    this.messages = [];
    this.shouldStop = false;
  }

  stop(): void {
    this.shouldStop = true;
  }
}

// ============================================================================
// EXAMPLE TOOLS
// ============================================================================

export const consoleTool: ToolDefinition<z.ZodObject<{
  message: z.ZodString;
  level: z.ZodOptional<z.ZodEnum<['info', 'warn', 'error']>>;
}>> = {
  id: 'console_log',
  name: 'Console Log',
  description: 'Logs a message to the console. Useful for debugging or displaying information.',
  parameters: z.object({
    message: z.string().describe('The message to log to the console'),
    level: z.enum(['info', 'warn', 'error']).optional().describe('The log level')
  }),
  execute: async (params) => {
    const level = params.level || 'info';
    // Use type assertion to ensure level is a valid console method
    const logMethod = (console as any)[level] || console.log;
    logMethod('[CONSOLE TOOL]:', params.message);
    return { 
      success: true, 
      logged: params.message,
      level,
      timestamp: new Date().toISOString()
    };
  }
};

export const calculatorTool: ToolDefinition<z.ZodObject<{
  operation: z.ZodEnum<['add', 'subtract', 'multiply', 'divide']>;
  a: z.ZodNumber;
  b: z.ZodNumber;
}>> = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Performs basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  }),
  execute: async (params) => {
    let result: number;
    
    switch (params.operation) {
      case 'add':
        result = params.a + params.b;
        break;
      case 'subtract':
        result = params.a - params.b;
        break;
      case 'multiply':
        result = params.a * params.b;
        break;
      case 'divide':
        if (params.b === 0) throw new Error('Division by zero');
        result = params.a / params.b;
        break;
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }
    
    return {
      operation: params.operation,
      a: params.a,
      b: params.b,
      result
    };
  }
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

// Example 1: Workers AI (Cloudflare)
async function exampleWorkersAI(env: any) {
  const registry = new ToolRegistry();
  registry.register(consoleTool);
  registry.register(calculatorTool);

  const agent = new Agent({
    modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    provider: { type: 'workers-ai', binding: env.AI },
    systemPrompt: 'You are a helpful assistant with access to tools.',
    toolRegistry: registry,
    maxIterations: 10
  });

  for await (const chunk of agent.run('Calculate 15 * 3 and log the result')) {
    console.log(chunk);
  }
}

// Example 2: OpenAI
async function exampleOpenAI() {
  const registry = new ToolRegistry();
  registry.register(consoleTool);

  const agent = new Agent({
    modelId: 'gpt-4o-mini',
    provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
    systemPrompt: 'You are a helpful assistant.',
    toolRegistry: registry
  });

  for await (const chunk of agent.run('Log "Hello from OpenAI"')) {
    console.log(chunk);
  }
}

// Example 3: Anthropic
async function exampleAnthropic() {
  const registry = new ToolRegistry();
  registry.register(calculatorTool);

  const agent = new Agent({
    modelId: 'claude-3-5-sonnet-20241022',
    provider: { type: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY! },
    systemPrompt: 'You are a helpful assistant.',
    toolRegistry: registry
  });

  for await (const chunk of agent.run('What is 42 divided by 7?')) {
    console.log(chunk);
  }
}

// Example 4: Next.js API Route with Workers AI
// app/api/chat/route.ts
/*
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Agent, ToolRegistry, consoleTool } from '@/lib/agent';
import { durableObjectTools } from '@/src/tools/durable-object-tools';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { message } = await req.json();
  const env = getRequestContext().env;

  // Setup tools
  const registry = new ToolRegistry();
  registry.register(consoleTool);
  
  // Add your durable object tools
  const doTools = durableObjectTools(env);

  for (const tool of doTools) {
    registry.register(tool);
  }

  // Create agent
  const agent = new Agent({
    modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    provider: { type: 'workers-ai', binding: env.AI },
    systemPrompt: 'You are a helpful assistant. Use tools when needed.',
    toolRegistry: registry,
    maxIterations: 10
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of agent.run(message)) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked'
    }
  });
}
*/
