export type MessageRole = 'user' | 'assistant';

export interface IMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface IChatState {
  messages: IMessage[];
  isLoading: boolean;
} 