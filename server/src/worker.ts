import { httpServerHandler } from "cloudflare:node";
import { createApp } from "@/app.js";
import { PORT } from "@/lib/constants.js";

const app = createApp();

app.listen(PORT);

export default httpServerHandler({ port: Number(PORT) });
