export interface User {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'document';
  storageId: string;
  r2Key: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  embeddingId?: string;
  extractedText?: string;
  metadata?: {
    pages?: number;
    dimensions?: {
      width: number;
      height: number;
    };
  };
  createdAt: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: 'text' | 'code' | 'markdown' | 'html' | 'json';
  content: string;
  language?: string;
  createdBy: string;
  embeddingId?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  userId: string;
  activeKnowledgePackIds?: string[];
  activeFileIds?: string[];
  activeArtifactIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  userId: string;
  toolCalls?: {
    toolName: string;
    args: any;
    result?: any;
  }[];
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  winCondition: string;
  model: string;
  temperature: number;
  tools: string[];
  createdBy: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const KV_PREFIXES = {
  USER: 'user:',
  FILE: 'file:',
  ARTIFACT: 'artifact:',
  CONVERSATION: 'conversation:',
  MESSAGE: 'message:',
  AGENT: 'agent:',
  COUNCIL_SESSION_INDEX: 'council_session_index:',
  KNOWLEDGE_PACK_INDEX: 'knowledge_pack_index:',
  // Used for Durable Object indexing and metadata
  KNOWLEDGE_PACK: 'knowledge_pack:',
  COUNCIL_SESSION: 'council_session:'
} as const;

export type KVPrefix = typeof KV_PREFIXES[keyof typeof KV_PREFIXES];
