export type Intent = 'complaint' | 'inquiry' | 'emergency' | 'general';

export type ResponseStyle = 'formal' | 'concise' | 'detailed';

export interface DeskQuery {
  id: string;
  timestamp: number;
  text: string;
  intent: Intent;
  replyStyle: ResponseStyle;
  response?: string;
  isSynced: boolean;
  language: string;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface Protocol {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  lastUpdated: number;
  category: string;
}
