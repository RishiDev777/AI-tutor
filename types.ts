export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  image?: string; // Base64 string of attached image
}

export interface SessionConfig {
  grade: string;
  subject: string;
  chapter: string;
  mode: string;
}

export interface ChatSessionState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}