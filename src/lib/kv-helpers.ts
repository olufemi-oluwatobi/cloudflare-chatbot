import { KV_PREFIXES } from '../types/kv-schema';
import type {
  User,
  FileMetadata,
  Artifact,
  Conversation,
  Message,
  Agent,
} from '../types/kv-schema';

export class KVStore {
  constructor(private kv: KVNamespace) {}

  async getUser(id: string): Promise<User | null> {
    return await this.kv.get(`${KV_PREFIXES.USER}${id}`, 'json');
  }

  async setUser(user: User): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.USER}${user.id}`, JSON.stringify(user));
  }

  async getFile(id: string): Promise<FileMetadata | null> {
    return await this.kv.get(`${KV_PREFIXES.FILE}${id}`, 'json');
  }

  async setFile(file: FileMetadata): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.FILE}${file.id}`, JSON.stringify(file));
  }

  async listFilesByUser(userId: string): Promise<FileMetadata[]> {
    const list = await this.kv.list({ prefix: KV_PREFIXES.FILE });
    const files: FileMetadata[] = [];
    
    for (const key of list.keys) {
      const file = await this.kv.get<FileMetadata>(key.name, 'json');
      if (file && file.uploadedBy === userId) {
        files.push(file);
      }
    }
    
    return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deleteFile(id: string): Promise<boolean> {
    await this.kv.delete(`${KV_PREFIXES.FILE}${id}`);
    return true;
  }

  async updateFileMetadata(id: string, updates: Partial<FileMetadata>): Promise<FileMetadata | null> {
    const existing = await this.getFile(id);
    if (!existing) return null;
    
    const updatedFile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.setFile(updatedFile);
    return updatedFile;
  }

  async addFileToConversation(fileId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.kv.get<Conversation>(
      `${KV_PREFIXES.CONVERSATION}${conversationId}`,
      'json'
    );
    
    if (!conversation) return false;
    
    const updatedConversation = {
      ...conversation,
      activeFileIds: [...(conversation.activeFileIds || []), fileId],
      updatedAt: new Date().toISOString()
    };
    
    await this.kv.put(
      `${KV_PREFIXES.CONVERSATION}${conversationId}`,
      JSON.stringify(updatedConversation)
    );
    
    return true;
  }

  async removeFileFromConversation(fileId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.kv.get<Conversation>(
      `${KV_PREFIXES.CONVERSATION}${conversationId}`,
      'json'
    );
    
    if (!conversation || !conversation.activeFileIds) return false;
    
    const updatedConversation = {
      ...conversation,
      activeFileIds: conversation.activeFileIds.filter(id => id !== fileId),
      updatedAt: new Date().toISOString()
    };
    
    await this.kv.put(
      `${KV_PREFIXES.CONVERSATION}${conversationId}`,
      JSON.stringify(updatedConversation)
    );
    
    return true;
  }

  async getFilesForConversation(conversationId: string): Promise<FileMetadata[]> {
    const conversation = await this.kv.get<Conversation>(
      `${KV_PREFIXES.CONVERSATION}${conversationId}`,
      'json'
    );
    
    if (!conversation?.activeFileIds?.length) return [];
    
    const files = await Promise.all(
      conversation.activeFileIds.map(id => this.getFile(id))
    );
    
    return files.filter((file): file is FileMetadata => file !== null);
  }

  async searchFiles(query: string, userId: string): Promise<FileMetadata[]> {
    // This is a simple in-memory search. For production, consider using a dedicated search service
    // like Cloudflare's own search or a third-party service like Algolia or MeiliSearch.
    const files = await this.listFilesByUser(userId);
    const queryLower = query.toLowerCase();
    
    return files.filter(file => 
      file.name.toLowerCase().includes(queryLower) ||
      (file.metadata && 'extractedText' in file.metadata ? 
        String(file.metadata.extractedText).toLowerCase().includes(queryLower) : 
        false)
    );
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    return await this.kv.get(`${KV_PREFIXES.ARTIFACT}${id}`, 'json');
  }

  async setArtifact(artifact: Artifact): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.ARTIFACT}${artifact.id}`, JSON.stringify(artifact));
  }

  async listArtifactsByUser(userId: string): Promise<Artifact[]> {
    const list = await this.kv.list({ prefix: KV_PREFIXES.ARTIFACT });
    const artifacts: Artifact[] = [];
    
    for (const key of list.keys) {
      const artifact = await this.kv.get<Artifact>(key.name, 'json');
      if (artifact && artifact.createdBy === userId) {
        artifacts.push(artifact);
      }
    }
    
    return artifacts;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return await this.kv.get(`${KV_PREFIXES.CONVERSATION}${id}`, 'json');
  }

  async setConversation(conversation: Conversation): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.CONVERSATION}${conversation.id}`, JSON.stringify(conversation));
  }

  async listConversationsByUser(userId: string): Promise<Conversation[]> {
    const list = await this.kv.list({ prefix: KV_PREFIXES.CONVERSATION });
    const conversations: Conversation[] = [];
    
    for (const key of list.keys) {
      const conversation = await this.kv.get<Conversation>(key.name, 'json');
      if (conversation && conversation.userId === userId) {
        conversations.push(conversation);
      }
    }
    
    return conversations;
  }

  async getMessage(id: string): Promise<Message | null> {
    return await this.kv.get(`${KV_PREFIXES.MESSAGE}${id}`, 'json');
  }

  async setMessage(message: Message): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.MESSAGE}${message.id}`, JSON.stringify(message));
  }

  async listMessagesByConversation(conversationId: string): Promise<Message[]> {
    const list = await this.kv.list({ prefix: KV_PREFIXES.MESSAGE });
    const messages: Message[] = [];
    
    for (const key of list.keys) {
      const message = await this.kv.get<Message>(key.name, 'json');
      if (message && message.conversationId === conversationId) {
        messages.push(message);
      }
    }
    
    return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getAgent(id: string): Promise<Agent | null> {
    return await this.kv.get(`${KV_PREFIXES.AGENT}${id}`, 'json');
  }

  async setAgent(agent: Agent): Promise<void> {
    await this.kv.put(`${KV_PREFIXES.AGENT}${agent.id}`, JSON.stringify(agent));
  }

  async listAgentsByUser(userId: string): Promise<Agent[]> {
    const list = await this.kv.list({ prefix: KV_PREFIXES.AGENT });
    const agents: Agent[] = [];
    
    for (const key of list.keys) {
      const agent = await this.kv.get<Agent>(key.name, 'json');
      if (agent && agent.createdBy === userId) {
        agents.push(agent);
      }
    }
    
    return agents;
  }

  // Knowledge Pack Indexing
  async indexKnowledgePack(packId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.kv.put(
      `${KV_PREFIXES.KNOWLEDGE_PACK_INDEX}${userId}:${packId}`, 
      JSON.stringify({
        id: packId,
        userId,
        indexedAt: new Date().toISOString(),
        ...metadata
      })
    );
  }

  async listKnowledgePackIndexes(userId: string): Promise<Array<{
    id: string;
    userId: string;
    indexedAt: string;
    [key: string]: any;
  }>> {
    const list = await this.kv.list({ prefix: `${KV_PREFIXES.KNOWLEDGE_PACK_INDEX}${userId}:` });
    const results = [];
    
    for (const key of list.keys) {
      const item = await this.kv.get<{id: string; userId: string; indexedAt: string}>(key.name, 'json');
      if (item) {
        results.push(item);
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    );
  }

  async removeKnowledgePackIndex(packId: string, userId: string): Promise<void> {
    await this.kv.delete(`${KV_PREFIXES.KNOWLEDGE_PACK_INDEX}${userId}:${packId}`);
  }

  // Council Session Indexing
  async indexCouncilSession(sessionId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.kv.put(
      `${KV_PREFIXES.COUNCIL_SESSION_INDEX}${userId}:${sessionId}`, 
      JSON.stringify({
        id: sessionId,
        userId,
        indexedAt: new Date().toISOString(),
        ...metadata
      })
    );
  }

  async listCouncilSessionIndexes(userId: string): Promise<Array<{
    id: string;
    userId: string;
    indexedAt: string;
    [key: string]: any;
  }>> {
    const list = await this.kv.list({ prefix: `${KV_PREFIXES.COUNCIL_SESSION_INDEX}${userId}:` });
    const results = [];
    
    for (const key of list.keys) {
      const item = await this.kv.get<{id: string; userId: string; indexedAt: string}>(key.name, 'json');
      if (item) {
        results.push(item);
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    );
  }

  async removeCouncilSessionIndex(sessionId: string, userId: string): Promise<void> {
    await this.kv.delete(`${KV_PREFIXES.COUNCIL_SESSION_INDEX}${userId}:${sessionId}`);
  }

  // Artifact Methods
  async updateArtifact(id: string, updates: Partial<Artifact>): Promise<Artifact | null> {
    const existing = await this.getArtifact(id);
    if (!existing) return null;
    
    const updatedArtifact = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.setArtifact(updatedArtifact);
    return updatedArtifact;
  }

  async deleteArtifact(id: string): Promise<boolean> {
    await this.kv.delete(`${KV_PREFIXES.ARTIFACT}${id}`);
    return true;
  }

  async searchArtifacts(query: string, userId: string): Promise<Artifact[]> {
    const artifacts = await this.listArtifactsByUser(userId);
    const queryLower = query.toLowerCase();
    
    return artifacts.filter(artifact => 
      artifact.title.toLowerCase().includes(queryLower) ||
      artifact.content.toLowerCase().includes(queryLower) ||
      (artifact.tags && artifact.tags.some(tag => tag.toLowerCase().includes(queryLower)))
    );
  }

  // Agent Methods
  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | null> {
    const existing = await this.getAgent(id);
    if (!existing) return null;
    
    const updatedAgent = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.setAgent(updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: string): Promise<boolean> {
    await this.kv.delete(`${KV_PREFIXES.AGENT}${id}`);
    return true;
  }

  async searchAgents(query: string, userId: string): Promise<Agent[]> {
    const agents = await this.listAgentsByUser(userId);
    const queryLower = query.toLowerCase();
    
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(queryLower) ||
      agent.role.toLowerCase().includes(queryLower) ||
      agent.personality.toLowerCase().includes(queryLower) ||
      agent.winCondition.toLowerCase().includes(queryLower)
    );
  }

  // Knowledge Pack Index Methods
  async searchKnowledgePackIndexes(query: string, userId: string): Promise<Array<{
    id: string;
    userId: string;
    indexedAt: string;
    [key: string]: any;
  }>> {
    const indexes = await this.listKnowledgePackIndexes(userId);
    const queryLower = query.toLowerCase();
    
    return indexes.filter(index => {
      // Search in metadata if available
      const metadata = Object.entries(index).filter(([key]) => 
        !['id', 'userId', 'indexedAt'].includes(key)
      );
      
      return metadata.some(([_, value]) => 
        String(value).toLowerCase().includes(queryLower)
      );
    });
  }

  // Council Session Index Methods
  async searchCouncilSessionIndexes(query: string, userId: string): Promise<Array<{
    id: string;
    userId: string;
    indexedAt: string;
    [key: string]: any;
  }>> {
    const indexes = await this.listCouncilSessionIndexes(userId);
    const queryLower = query.toLowerCase();
    
    return indexes.filter(index => {
      // Search in metadata if available
      const metadata = Object.entries(index).filter(([key]) => 
        !['id', 'userId', 'indexedAt'].includes(key)
      );
      
      return metadata.some(([_, value]) => 
        String(value).toLowerCase().includes(queryLower)
      );
    });
  }
}
