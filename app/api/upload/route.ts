import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

import { KVStore } from '../../../src/lib/kv-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const env = getRequestContext().env;
    
    // Upload file to R2
    const objectKey = `uploads/${Date.now()}-${file.name}`;
    await env.FILE_STORAGE.put(objectKey, file.stream());


    // Store metadata in KV
    const fileMetadata = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type as 'image' | 'pdf' | 'document',
      storageId: objectKey,
      r2Key: objectKey,
      size: file.size,
      mimeType: file.type,
      uploadedBy: 'system',
      embeddingId: undefined,
      extractedText: undefined,
      metadata: undefined,
      createdAt: new Date().toISOString(),
    };
    
    const kvStore = new KVStore(env.BREADCRUMB_KV);
    await kvStore.setFile(fileMetadata);

  

    return new Response(JSON.stringify({
      success: true,
      file: fileMetadata,
      objectKey
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to upload file',
        details: err instanceof Error ? err.message : String(err)
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET() {
  try {
    const env = getRequestContext().env;
    
    // List all files from KV
    const list = await env.MY_KV_NAMESPACE.list({ prefix: 'file:' });
    const files = await Promise.all(
      list.keys.map(async (key) => {
        const value = await env.MY_KV_NAMESPACE.get(key.name, 'json');
        return value;
      })
    );

    // Get counter value
    const counterId = env.COUNTER.idFromName('A');
    const counter = env.COUNTER.get(counterId);
    const counterResponse = await counter.fetch('http://counter/');
    const counterValue = await counterResponse.text();

    return new Response(JSON.stringify({
      files,
      totalUploads: files.length,
      counterValue: parseInt(counterValue, 10)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('List files error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list files',
        details: err instanceof Error ? err.message : String(err)
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
