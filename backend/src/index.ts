/**
 * ai-net backend server entry point.
 * 
 * Initializes all agents and starts the HTTP/WebSocket server.
 */

import { createApp } from './api/app';
import { initializeAgents } from './agents';

async function main() {
  console.log('[ai-net-backend] Starting server...');

  try {
    // Initialize all agents and register them
    console.log('[ai-net-backend] Initializing agents...');
    await initializeAgents();

    // Create and start the server
    const { httpServer } = createApp();
    
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    
    httpServer.listen(port, () => {
      console.log(`[ai-net-backend] Server running on http://localhost:${port}`);
      console.log('[ai-net-backend] Available endpoints:');
      console.log('  - POST /api/tasks                    - Submit new tasks');
      console.log('  - GET  /api/tasks/:id               - Get task status');
      console.log('  - WS   /tasks/:id/stream            - Stream task events');
      console.log('  - POST /api/agents/register         - Register new agents');
      console.log('  - GET  /api/agents                  - List all agents');
      console.log('  - GET  /api/agents/capability/:type - Find agents by capability');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[ai-net-backend] Received SIGTERM, shutting down gracefully...');
      httpServer.close(() => {
        console.log('[ai-net-backend] Server closed.');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[ai-net-backend] Received SIGINT, shutting down gracefully...');
      httpServer.close(() => {
        console.log('[ai-net-backend] Server closed.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[ai-net-backend] Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
