import { Router, type Request, type Response } from "express";
import { startChat } from "@/services/claude.js";
import { checkBudget, recordUsage } from "@/lib/rateLimit.js";

const router = Router();

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  systemPrompt: string;
}

function clientIp(req: Request): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0]!.trim();
  return req.ip ?? "unknown";
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, systemPrompt } = req.body as ChatBody;

  if (!messages || !systemPrompt) {
    res.status(400).json({ error: "Missing messages or systemPrompt" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  const ip = clientIp(req);
  const budget = await checkBudget(ip);
  if (!budget.ok) {
    res.status(429).json({
      error:
        budget.scope === "global"
          ? "Daily token budget exhausted. Try again tomorrow."
          : "Per-user daily token budget exhausted. Try again tomorrow.",
      scope: budget.scope,
      used: budget.used,
      limit: budget.limit,
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { stream, textChunks } = startChat({ messages, systemPrompt });

  try {
    for await (const chunk of textChunks) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    try {
      const final = await stream.finalMessage();
      const tokens =
        (final.usage?.input_tokens ?? 0) + (final.usage?.output_tokens ?? 0);
      await recordUsage(ip, tokens);
    } catch {
      // stream may have errored before producing usage; nothing to record
    }
  }
  res.end();
});

export default router;
