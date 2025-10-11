export interface CouncilSessionState {
  id: string;
  question: string;
  stage: 'initializing' | 'deliberating' | 'synthesizing_round' | 'synthesizing_final' | 'completed' | 'failed';
  maxRounds: number;
  currentRound: number;
  createdBy: string;
  agentIds: string[];
  decision?: string;
  consensusScore?: number;
  confidenceLevel?: number;
  attachedFiles?: string[];
  attachedArtifacts?: string[];
  deliberations: {
    round: number;
    agentId: string;
    content: string;
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export class CouncilSession {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  sessionState: CouncilSessionState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!this.sessionState) {
      this.sessionState = await this.storage.get<CouncilSessionState>('session') || null;
    }

    switch (path) {
      case '/initialize':
        return this.initialize(request);
      case '/deliberate':
        return this.addDeliberation(request);
      case '/synthesize':
        return this.synthesize(request);
      case '/complete':
        return this.complete(request);
      case '/get':
        return this.getSession();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async initialize(request: Request) {
    const data = await request.json() as Partial<CouncilSessionState>;
    
    this.sessionState = {
      id: data.id || crypto.randomUUID(),
      question: data.question || '',
      stage: 'initializing',
      maxRounds: data.maxRounds || 3,
      currentRound: 0,
      createdBy: data.createdBy || '',
      agentIds: data.agentIds || [],
      attachedFiles: data.attachedFiles,
      attachedArtifacts: data.attachedArtifacts,
      deliberations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.put('session', this.sessionState);
    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async addDeliberation(request: Request) {
    if (!this.sessionState) {
      return new Response('Session not initialized', { status: 400 });
    }

    const { agentId, content } = await request.json() as { agentId: string; content: string };
    
    this.sessionState.deliberations.push({
      round: this.sessionState.currentRound,
      agentId,
      content,
      timestamp: new Date().toISOString(),
    });

    this.sessionState.stage = 'deliberating';
    this.sessionState.updatedAt = new Date().toISOString();

    await this.storage.put('session', this.sessionState);
    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async synthesize(request: Request) {
    if (!this.sessionState) {
      return new Response('Session not initialized', { status: 400 });
    }

    const { round } = await request.json() as { round: number };
    
    this.sessionState.currentRound = round;
    this.sessionState.stage = round >= this.sessionState.maxRounds ? 'synthesizing_final' : 'synthesizing_round';
    this.sessionState.updatedAt = new Date().toISOString();

    await this.storage.put('session', this.sessionState);
    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async complete(request: Request) {
    if (!this.sessionState) {
      return new Response('Session not initialized', { status: 400 });
    }

    const { decision, consensusScore, confidenceLevel } = await request.json() as {
      decision: string;
      consensusScore: number;
      confidenceLevel: number;
    };

    this.sessionState.decision = decision;
    this.sessionState.consensusScore = consensusScore;
    this.sessionState.confidenceLevel = confidenceLevel;
    this.sessionState.stage = 'completed';
    this.sessionState.updatedAt = new Date().toISOString();

    await this.storage.put('session', this.sessionState);
    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getSession() {
    if (!this.sessionState) {
      return new Response('Session not initialized', { status: 404 });
    }

    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
