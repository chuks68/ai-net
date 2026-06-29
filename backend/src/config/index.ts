import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet", "local", "futurenet"]).default("testnet"),
  STELLAR_HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
  VENICE_API_KEY: z.string().min(1, "VENICE_API_KEY is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  STELLAR_COORDINATOR_SECRET: z.string().optional(),
  STELLAR_TEST_SECRET: z.string().optional(),
});

let _config: z.infer<typeof envSchema> | null = null;

export function loadConfig(): z.infer<typeof envSchema> {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    console.error(`[config] Environment validation failed:\n  ${missing}`);
    process.exit(1);
  }

  _config = result.data;
  return _config;
}

export function getConfig(): z.infer<typeof envSchema> {
  if (!_config) throw new Error("Config not loaded. Call loadConfig() first.");
  return _config;
}
