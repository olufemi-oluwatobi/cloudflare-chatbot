import { z } from 'zod';
import { tool } from 'ai';
import { Tool } from 'ai';

type Env = {
  COUNTER: DurableObjectNamespace;
  [key: string]: any;
};

// Define the tool schemas using Zod
export const incrementCounterSchema = z.object({
  amount: z.number().default(1).describe('The amount to increment the counter by'),
});

export const getCounterValueSchema = z.object({
  // No parameters needed for this tool
});

// Create a custom tool type that includes our environment
type DurableObjectTool<T extends z.ZodType> = Omit<Tool<T>, 'execute'> & {
  execute: (params: z.infer<T>, env: Env) => Promise<any>;
};


export const durableObjectTools = (env: Env) => {
  return {
    incrementCounter: tool({
      description: 'Increment the counter in the Durable Object',
      parameters: incrementCounterSchema,
      execute: async (params: z.infer<typeof incrementCounterSchema>) => {
        try {
          const counterId = env.COUNTER.idFromName('A');
          const counter = env.COUNTER.get(counterId);
          
          // Call the increment endpoint on the Durable Object
          const response = await counter.fetch('http://counter/increment', {
            method: 'POST',
            body: JSON.stringify({ amount: params.amount })
          });
          
          const value = await response.text();
          return { success: true, value: parseInt(value, 10) };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      },
    }),
    getCounterValue: tool({
      description: 'Get the current value of the counter from the Durable Object',
      parameters: getCounterValueSchema,
      execute: async (_params: z.infer<typeof getCounterValueSchema>) => {
        try {
          const counterId = env.COUNTER.idFromName('A');
          const counter = env.COUNTER.get(counterId);
          
          const response = await counter.fetch('http://counter/');
          const value = await response.text();
          
          return { 
            success: true, 
            value: parseInt(value, 10) 
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      },
    }),
  };
};
