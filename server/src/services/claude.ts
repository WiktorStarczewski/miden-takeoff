import Anthropic from "@anthropic-ai/sdk";
import {
  SKILLS_BETA,
  toBetaSkill,
  CONTRACTS_SKILLS,
  DAPP_SKILLS,
} from "@/lib/skills.js";

let globalClient: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!globalClient) {
    globalClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return globalClient;
}

const CODE_EXECUTION_BETA = "code-execution-2025-08-25";

export interface ChatRequest {
  mode: "contracts" | "dapp";
  messages: { role: "user" | "assistant"; content: string }[];
  systemPrompt: string;
}

export function startChat(req: ChatRequest) {
  const client = getClient();
  const stream = client.beta.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2 ** 14,
    cache_control: { type: "ephemeral" },
    betas: [CODE_EXECUTION_BETA, SKILLS_BETA],
    container: {
      skills:
        req.mode === "contracts"
          ? CONTRACTS_SKILLS.map(toBetaSkill)
          : DAPP_SKILLS.map(toBetaSkill),
    },
    system: req.systemPrompt,
    messages: req.messages,
    tools: [
      { type: "web_fetch_20260209", name: "web_fetch" },
      // { type: "code_execution_20250825", name: "code_execution" },
    ],
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
