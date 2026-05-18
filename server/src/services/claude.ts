import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  systemPrompt: string;
}

export function startChat(req: ChatRequest) {
  const stream = getClient().messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    cache_control: { type: "ephemeral" },
    system: req.systemPrompt,
    messages: req.messages,
  });

  async function* textChunks(): AsyncGenerator<string, void, unknown> {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  return { stream, textChunks: textChunks() };
}
