/**
 * ai-net backend server entry point.
 *
 * Initializes all agents and starts the HTTP/WebSocket server.
 */

import { createApp } from "./api/app";
import { initializeAgents } from "./agents";
import { startAgentSync } from "./registry/sync";
import { loadConfig, getConfig } from "./config";

async function main() {
  // ── Validate env config at startup ──────────────────────────────────────────
  loadConfig();
  const config = getConfig();

  console.log("[ai-net-backend] Starting server...");

  try {
    // Start agent sync
    startAgentSync();

    // Initialize all agents and register them
    console.log("[ai-net-backend] Initializing agents...");
    await initializeAgents();

    // Create and start the server
    const { httpServer } = createApp();

    const port = config.PORT;

    httpServer.listen(port, () => {
      console.log(`[ai-net-backend] Server running on http://localhost:${port}`);
      console.log("[ai-net-backend] Available endpoints:");
      console.log("  - GET  /health                    - Health check");
      console.log("  - GET  /health/deep               - Deep health check");
      console.log("  - POST /api/tasks                 - Submit new tasks");
      console.log("  - GET  /api/tasks/:id              - Get task status");
      console.log("  - WS   /tasks/:id/stream           - Stream task events");
      console.log("  - POST /api/agents/register        - Register new agents");
      console.log("  - GET  /api/agents                 - List all agents");
      console.log("  - GET  /api/agents/capability/:type - Find agents by capability");
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = (signal: string) => {
      console.log(`[ai-net-backend] Received ${signal}, shutting down gracefully...`);
      const timeout = setTimeout(() => {
        console.error("[ai-net-backend] Forced shutdown after 10s timeout");
        process.exit(1);
      }, 10_000);

      httpServer.close(() => {
        clearTimeout(timeout);
        console.log("[ai-net-backend] Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    console.error("[ai-net-backend] Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
