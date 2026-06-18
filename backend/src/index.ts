import { createApp } from "./api";

const PORT = process.env.PORT ?? 3000;
createApp().listen(PORT, () => console.log(`ai-net backend listening on :${PORT}`));
