import { getRequestContext } from "@cloudflare/next-on-pages";
export const runtime = 'edge';

export async function GET() {
  try {
    const env = getRequestContext().env;
    
    // Example using KV
    await env.MY_KV_NAMESPACE.put('last_accessed', new Date().toISOString());
    const lastAccessed = await env.MY_KV_NAMESPACE.get('last_accessed');
    
    // Example using Durable Object counter
    const counterId = env.COUNTER.idFromName('A');
    const counter = env.COUNTER.get(counterId);
    
    // Increment counter
    await counter.fetch('http://counter/increment');
    
    // Get current counter value
    const counterResponse = await counter.fetch('http://counter/');
    const counterValue = await counterResponse.text();
    
    // Example R2 bucket list (just metadata, not the actual files)
    const objects = await env.MY_BUCKET.list();
    const fileCount = objects.objects.length;
    
    return new Response(
      JSON.stringify({
        message: 'Hello from Cloudflare Workers with bindings!',
        lastAccessed,
        counterValue: parseInt(counterValue, 10),
        fileCount,
        files: objects.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        }))
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'An error occurred',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
