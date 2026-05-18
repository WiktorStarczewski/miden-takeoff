export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8081";

export async function streamChat(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  const res = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    callbacks.onError(`Server error: ${err}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);

      try {
        const parsed = JSON.parse(data) as
          | { text: string }
          | { done: boolean }
          | { error: string };

        if ("text" in parsed) {
          callbacks.onChunk(parsed.text);
        } else if ("done" in parsed) {
          callbacks.onDone();
        } else if ("error" in parsed) {
          callbacks.onError(parsed.error);
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
