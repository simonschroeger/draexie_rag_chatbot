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

declare global {
  interface Window {
    mascot?: {
      setState(name: string, variant?: number): void;
      readonly state: string;
      readonly caption: string;
    };
  }
}
