import { createApp } from "./api";
import { startAgentSync } from "./registry/sync";

const PORT = process.env.PORT ?? 3000;

startAgentSync();
createApp().listen(PORT, () => console.log(`ai-net backend listening on :${PORT}`));
import { createApp } from "./api/app";
import { startAgentSync } from "./registry/sync";

const PORT = Number(process.env.PORT ?? 3000);

startAgentSync();
const { httpServer } = createApp();
httpServer.listen(PORT, () => console.log(`ai-net backend listening on :${PORT}`));
