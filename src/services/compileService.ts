export interface CompileCallbacks {
  onOutput: (text: string) => void;
  onResult: (result: {
    success: boolean;
    output: string;
    packageBase64?: string;
    masmSource?: string;
    txScripts?: Record<string, string>;
  }) => void;
  onError: (error: string) => void;
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8081";

export async function compileContract(
  files: Record<string, string>,
  callbacks: CompileCallbacks,
  signal?: AbortSignal,
) {
  const res = await fetch(`${apiUrl}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
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

      try {
        const data = JSON.parse(line.slice(6));

        if (data.output) {
          callbacks.onOutput(data.output);
        } else if (data.result) {
          callbacks.onResult(data.result);
        } else if (data.error) {
          callbacks.onError(data.error);
        }
      } catch {
        // Skip malformed
      }
    }
  }
}
