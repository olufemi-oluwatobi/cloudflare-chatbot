export interface KnowledgePackState {
  id: string;
  title: string;
  description: string;
  content: string;
  councilSessionId: string;
  createdBy: string;
  embeddingId?: string;
  tags?: string[];
  isPublic?: boolean;
  consensusScore: number;
  sourceFiles?: string[];
  sourceArtifacts?: string[];
  entries: {
    content: string;
    agentId: string;
    score: number;
    sources: string[];
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export class KnowledgePack {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  packState: KnowledgePackState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!this.packState) {
      this.packState = await this.storage.get<KnowledgePackState>('pack') || null;
    }

    switch (path) {
      case '/create':
        return this.create(request);
      case '/add-entry':
        return this.addEntry(request);
      case '/finalize':
        return this.finalize(request);
      case '/get':
        return this.getPack();
      case '/update':
        return this.update(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async create(request: Request) {
    const data = await request.json() as Partial<KnowledgePackState>;
    
    this.packState = {
      id: data.id || crypto.randomUUID(),
      title: data.title || '',
      description: data.description || '',
      content: '',
      councilSessionId: data.councilSessionId || '',
      createdBy: data.createdBy || '',
      consensusScore: 0,
      entries: [],
      tags: data.tags,
      isPublic: data.isPublic,
      sourceFiles: data.sourceFiles,
      sourceArtifacts: data.sourceArtifacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async addEntry(request: Request) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    const { content, agentId, score, sources } = await request.json() as {
      content: string;
      agentId: string;
      score: number;
      sources: string[];
    };

    this.packState.entries.push({
      content,
      agentId,
      score,
      sources,
      timestamp: new Date().toISOString(),
    });

    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async finalize(request: Request) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    const { content, consensusScore, embeddingId } = await request.json() as {
      content: string;
      consensusScore: number;
      embeddingId?: string;
    };

    this.packState.content = content;
    this.packState.consensusScore = consensusScore;
    this.packState.embeddingId = embeddingId;
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async update(request: Request) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    const updates = await request.json() as Partial<KnowledgePackState>;
    
    this.packState = {
      ...this.packState,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getPack() {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 404 });
    }

    return new Response(JSON.stringify(this.packState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Search through knowledge pack entries
  async searchEntries(query: string) {
    if (!this.packState) {
      return [];
    }

    const queryLower = query.toLowerCase();
    return this.packState.entries.filter(entry => 
      entry.content.toLowerCase().includes(queryLower) ||
      entry.agentId.toLowerCase().includes(queryLower) ||
      entry.sources.some(source => source.toLowerCase().includes(queryLower))
    );
  }

  // Update an existing entry
  async updateEntry(entryIndex: number, updates: Partial<KnowledgePackState['entries'][0]>) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    if (entryIndex < 0 || entryIndex >= this.packState.entries.length) {
      return new Response('Invalid entry index', { status: 400 });
    }

    this.packState.entries[entryIndex] = {
      ...this.packState.entries[entryIndex],
      ...updates,
      timestamp: new Date().toISOString()
    };
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState.entries[entryIndex]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Remove an entry by index
  async removeEntry(entryIndex: number) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    if (entryIndex < 0 || entryIndex >= this.packState.entries.length) {
      return new Response('Invalid entry index', { status: 400 });
    }

    const [removed] = this.packState.entries.splice(entryIndex, 1);
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(removed), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Add tags to the knowledge pack
  async addTags(tags: string[]) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    const uniqueTags = new Set([...(this.packState.tags || []), ...tags]);
    this.packState.tags = Array.from(uniqueTags);
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState.tags), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Remove tags from the knowledge pack
  async removeTags(tags: string[]) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    if (!this.packState.tags) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tagSet = new Set(tags);
    this.packState.tags = this.packState.tags.filter(tag => !tagSet.has(tag));
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify(this.packState.tags), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Add source files or artifacts
  async addSources({ files = [] as string[], artifacts = [] as string[] }) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    // Add files
    if (files.length > 0) {
      this.packState.sourceFiles = [
        ...new Set([...(this.packState.sourceFiles || []), ...files])
      ];
    }

    // Add artifacts
    if (artifacts.length > 0) {
      this.packState.sourceArtifacts = [
        ...new Set([...(this.packState.sourceArtifacts || []), ...artifacts])
      ];
    }

    this.packState.updatedAt = new Date().toISOString();
    await this.storage.put('pack', this.packState);

    return new Response(JSON.stringify({
      sourceFiles: this.packState.sourceFiles,
      sourceArtifacts: this.packState.sourceArtifacts
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update the consensus score
  async updateConsensusScore(score: number) {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    this.packState.consensusScore = score;
    this.packState.updatedAt = new Date().toISOString();

    await this.storage.put('pack', this.packState);
    return new Response(JSON.stringify({ consensusScore: this.packState.consensusScore }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get statistics about the knowledge pack
  async getStats() {
    if (!this.packState) {
      return new Response('Knowledge pack not initialized', { status: 400 });
    }

    const stats = {
      entryCount: this.packState.entries.length,
      averageScore: this.packState.entries.reduce((sum, entry) => sum + entry.score, 0) / 
                   (this.packState.entries.length || 1),
      sourceFileCount: this.packState.sourceFiles?.length || 0,
      sourceArtifactCount: this.packState.sourceArtifacts?.length || 0,
      tagCount: this.packState.tags?.length || 0,
      lastUpdated: this.packState.updatedAt,
      createdAt: this.packState.createdAt
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
