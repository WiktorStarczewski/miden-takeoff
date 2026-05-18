import { Router, type Request, type Response } from "express";
import {
  compileContractApi,
  compileContractDocker,
} from "@/services/compiler.js";
import { NODE_ENV } from "@/lib/constants.js";

const router = Router();

let activeCompilations = 0;
const MAX_CONCURRENT = 1; // Serialized — shared Docker cache is not concurrent-safe

const useDocker = NODE_ENV !== "production";
const compileContract = useDocker ? compileContractDocker : compileContractApi;

router.post("/compile", async (req: Request, res: Response) => {
  const { files } = req.body as { files?: Record<string, string> };

  if (!files || typeof files !== "object") {
    res.status(400).json({ error: "Missing files object" });
    return;
  }

  if (useDocker && activeCompilations >= MAX_CONCURRENT) {
    res
      .status(429)
      .json({ error: "Too many concurrent compilations. Try again shortly." });
    return;
  }

  activeCompilations++;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders(); // send headers immediately

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force flush — Node's HTTP response doesn't auto-flush SSE
    if (
      typeof (res as unknown as { flush?: () => void }).flush === "function"
    ) {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  try {
    for await (const event of compileContract(files)) {
      if (event.type === "output") {
        send({ output: event.text });
      } else {
        send({ result: event.result });
      }
    }
    send({ done: true });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compilation failed";
    send({ error: message });
    res.end();
  } finally {
    activeCompilations--;
  }
});

export default router;
