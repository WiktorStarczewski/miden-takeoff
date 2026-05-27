import { useCallback, useRef } from "react";
import { usePlaygroundStore } from "@/store/usePlaygroundStore";
import { streamChat } from "@/services/chatService";
import { extractCodeBlocks } from "@/lib/codeParser";
import {
  getContractSystemPrompt,
  getDappSystemPrompt,
} from "@/lib/systemPrompts";

export function useChat() {
  const mode = usePlaygroundStore((s) => s.mode);
  const getChat = usePlaygroundStore((s) => s.getChat);
  const addMessage = usePlaygroundStore((s) => s.addMessage);
  const updateStreamingMessage = usePlaygroundStore(
    (s) => s.updateStreamingMessage,
  );
  const finalizeStream = usePlaygroundStore((s) => s.finalizeStream);
  const streamingMessageId = usePlaygroundStore((s) => s.streamingMessageId);
  const contracts = usePlaygroundStore((s) => s.contracts);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (userMessage: string) => {
      if (streamingMessageId) return; // Already streaming

      // Add user message
      const userMsg = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: userMessage,
      };
      addMessage(userMsg);

      // Create assistant placeholder
      const assistantId = crypto.randomUUID();
      addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      // Build messages for API
      const chat = getChat();
      const apiMessages = chat
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      // Get system prompt
      const systemPrompt =
        mode === "contracts"
          ? getContractSystemPrompt()
          : getDappSystemPrompt(Array.from(contracts.values()));

      // Stream
      let fullContent = "";
      abortRef.current = new AbortController();

      await streamChat(
        mode,
        apiMessages,
        systemPrompt,
        {
          onChunk: (text) => {
            fullContent += text;
            updateStreamingMessage(fullContent);
          },
          onDone: () => {
            // Extract code blocks and attach to message
            const codeBlocks = extractCodeBlocks(fullContent);
            const state = usePlaygroundStore.getState();
            const key = mode === "contracts" ? "contractChat" : "dappChat";
            usePlaygroundStore.setState({
              [key]: state[key].map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: fullContent,
                      isStreaming: false,
                      codeBlocks,
                    }
                  : msg,
              ),
              streamingMessageId: null,
            });
          },
          onError: (error) => {
            updateStreamingMessage(fullContent + `\n\n*Error: ${error}*`);
            finalizeStream();
          },
        },
        abortRef.current.signal,
      );
    },
    [
      mode,
      streamingMessageId,
      addMessage,
      getChat,
      updateStreamingMessage,
      finalizeStream,
      contracts,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // Finalize the stream and extract any code blocks from partial content
    const state = usePlaygroundStore.getState();
    const key = mode === "contracts" ? "contractChat" : "dappChat";
    const { streamingMessageId: smId } = state;
    if (smId) {
      const msg = state[key].find((m: { id: string }) => m.id === smId);
      const codeBlocks = msg ? extractCodeBlocks(msg.content) : [];
      usePlaygroundStore.setState({
        [key]: state[key].map((m: { id: string; content: string }) =>
          m.id === smId ? { ...m, isStreaming: false, codeBlocks } : m,
        ),
        streamingMessageId: null,
      });
    }
  }, [mode]);

  return { send, stop, isStreaming: !!streamingMessageId };
}
