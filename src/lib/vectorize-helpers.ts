export interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export class VectorizeHelper {
  constructor(
    private filesIndex: VectorizeIndex,
    private artifactsIndex: VectorizeIndex,
    private knowledgePacksIndex: VectorizeIndex
  ) {}

  async upsertFileEmbedding(id: string, embedding: number[], metadata?: Record<string, any>): Promise<void> {
    await this.filesIndex.upsert([
      {
        id,
        values: embedding,
        metadata: metadata || {},
      },
    ]);
  }

  async queryFileEmbeddings(embedding: number[], topK: number = 10): Promise<VectorizeMatch[]> {
    const results = await this.filesIndex.query(embedding, { topK });
    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  async upsertArtifactEmbedding(id: string, embedding: number[], metadata?: Record<string, any>): Promise<void> {
    await this.artifactsIndex.upsert([
      {
        id,
        values: embedding,
        metadata: metadata || {},
      },
    ]);
  }

  async queryArtifactEmbeddings(embedding: number[], topK: number = 10): Promise<VectorizeMatch[]> {
    const results = await this.artifactsIndex.query(embedding, { topK });
    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  async upsertKnowledgePackEmbedding(id: string, embedding: number[], metadata?: Record<string, any>): Promise<void> {
    await this.knowledgePacksIndex.upsert([
      {
        id,
        values: embedding,
        metadata: metadata || {},
      },
    ]);
  }

  async queryKnowledgePackEmbeddings(embedding: number[], topK: number = 10): Promise<VectorizeMatch[]> {
    const results = await this.knowledgePacksIndex.query(embedding, { topK });
    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  async queryAllEmbeddings(embedding: number[], topK: number = 5): Promise<{
    files: VectorizeMatch[];
    artifacts: VectorizeMatch[];
    knowledgePacks: VectorizeMatch[];
  }> {
    const [files, artifacts, knowledgePacks] = await Promise.all([
      this.queryFileEmbeddings(embedding, topK),
      this.queryArtifactEmbeddings(embedding, topK),
      this.queryKnowledgePackEmbeddings(embedding, topK),
    ]);

    return { files, artifacts, knowledgePacks };
  }

  async deleteFileEmbedding(id: string): Promise<void> {
    await this.filesIndex.deleteByIds([id]);
  }

  async deleteArtifactEmbedding(id: string): Promise<void> {
    await this.artifactsIndex.deleteByIds([id]);
  }

  async deleteKnowledgePackEmbedding(id: string): Promise<void> {
    await this.knowledgePacksIndex.deleteByIds([id]);
  }
}
