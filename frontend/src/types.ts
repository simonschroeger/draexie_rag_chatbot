export interface Milestone {
  id: string;
  date: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  description: string;
  risk_level?: 'low' | 'medium' | 'high';
}

export interface ArtifactData {
  title: string;
  status: string;
  milestones: Milestone[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifact?: {
    type: 'component' | 'html';
    name: string;
    data?: any;
    content?: string;
    bufferContent?: string;
  };
}
