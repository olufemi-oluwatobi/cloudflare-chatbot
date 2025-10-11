export class Counter {
  state: DurableObjectState;
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  // Handle HTTP requests
  async fetch(request: Request) {
    const url = new URL(request.url);
    let value = (await this.storage.get<number>('value')) || 0;

    switch (url.pathname) {
      case '/increment':
        value++;
        await this.storage.put('value', value);
        return new Response(value.toString());
      case '/decrement':
        value--;
        await this.storage.put('value', value);
        return new Response(value.toString());
      case '/':
        return new Response(value.toString());
      default:
        return new Response('Not found', { status: 404 });
    }
  }
}

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // This will be handled by the Durable Object
      const id = env.COUNTER.idFromName('A');
      const obj = env.COUNTER.get(id);
      return await obj.fetch(request);
    } catch (err: any) {
      return new Response(err.toString());
    }
  },
};
