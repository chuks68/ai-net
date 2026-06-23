import express from "express";
import cors from "cors";
import { tasksRouter } from "./routes/tasks";
import { agentsRouter } from "./routes/agents";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/agents", agentsRouter);
  app.use("/api/tasks", tasksRouter);
  return app;
}
