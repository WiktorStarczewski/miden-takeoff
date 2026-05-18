import express from "express";
import cors from "cors";
import {
  NODE_ENV,
  PORT,
  ALLOWED_ORIGINS,
  API_COMPILE_URL,
} from "@/lib/constants.js";
import chatRouter from "@/routes/chat.js";
import compileRouter from "@/routes/compile.js";

export const createApp = () => {
  const app = express();

  const allowedOrigins = ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.use(
    cors({
      origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.use("/api", chatRouter);
  app.use("/api", compileRouter);

  app.get("/", (_req, res) => {
    res.json({
      timestamp: Date.now(),
      env: { NODE_ENV, PORT, ALLOWED_ORIGINS, API_COMPILE_URL },
    });
  });

  return app;
};
