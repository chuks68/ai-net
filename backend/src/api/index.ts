// Re-export from app.ts — single source of truth for createApp
export { createApp, type AppOptions } from "./app";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/agents", agentsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/agents", agentsRouter);
  return app;
}
