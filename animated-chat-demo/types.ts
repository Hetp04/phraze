export interface ChatMessage {
  id: string;
  senderType: 'user' | 'ai';
  senderName: string;
  avatar: string;
  text: string;
  highlights?: string[];
  isStreaming?: boolean; // To handle the cursor effect if needed
}

export interface ScriptItem {
  senderType: 'user' | 'ai';
  senderName: string;
  avatar: string;
  text: string;
  highlights?: string[];
}
