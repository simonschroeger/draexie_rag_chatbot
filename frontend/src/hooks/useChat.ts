import { useState } from 'react';

export interface Chunk {
  num: number;
  source: string;
  text: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  chunks?: Chunk[];
}

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  
  const sendMessage = async (question: string) => {
    if (!question.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsGenerating(true);
    setStreamingMessage("");

    let currentAnswer = "";
    let currentSources: string[] = [];
    let currentChunks: Chunk[] = [];

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversation_id: conversationId }),
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          
          let parsed;
          try {
            parsed = JSON.parse(event.slice(6));
          } catch {
            continue;
          }

          if (parsed.sources) {
            currentSources = parsed.sources;
            currentChunks = parsed.chunks ?? [];
          } else if (parsed.token !== undefined) {
            currentAnswer += parsed.token;
            setStreamingMessage(currentAnswer);
          } else if (parsed.done) {
            setMessages(prev => [
              ...prev, 
              { 
                role: 'assistant', 
                content: currentAnswer,
                sources: currentSources,
                chunks: currentChunks
              }
            ]);
            setStreamingMessage("");
            setIsGenerating(false);
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: "Verbindungsfehler. Bitte versuche es erneut." }
      ]);
      setStreamingMessage("");
      setIsGenerating(false);
    }
  };

  return { messages, streamingMessage, isGenerating, sendMessage };
}