export interface Chunk {
  num: number;
  source: string;
  text: string;
  image_url?: string | null;
}

export interface RagMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  chunks?: Chunk[];
  suggestions?: string[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  qdrant: { ok: boolean; chunks: number; collection: string };
  ollama: { ok: boolean; model: string };
  last_ingestion: { filename: string; at: string } | null;
}

export interface ServerEvent {
  sources?: string[];
  chunks?: Chunk[];
  token?: string;
  done?: boolean;
  suggestions?: string[];
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  risk_level?: 'high' | 'medium' | 'low';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifact?: {
    type: string;
    name: string;
    data?: unknown;
    content?: string;
  };
}

declare global {
  interface Window {
    mascot?: {
      setState(name: string, variant?: number): void;
      readonly state: string;
      readonly caption: string;
    };
  }
}
