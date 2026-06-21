import { createApp } from "./api";
import { startAgentSync } from "./registry/sync";

const PORT = process.env.PORT ?? 3000;

startAgentSync();
createApp().listen(PORT, () => console.log(`ai-net backend listening on :${PORT}`));
