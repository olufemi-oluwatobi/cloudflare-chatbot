import { Counter } from '../../src/durable-objects/Counter';
import { CouncilSession } from '../../src/durable-objects/CouncilSession';
import { KnowledgePack } from '../../src/durable-objects/KnowledgePack';

// Export the Durable Objects so they can be bound to the Worker
export { Counter, CouncilSession, KnowledgePack };

// The Durable Objects will be accessible via the bindings
// No need for a fetch handler since we're only using Durable Objects
export default {
  async fetch() {
    return new Response('Durable Objects Worker is running');
  },
};
