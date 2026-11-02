import { z } from "zod";

const positiveInteger = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);
const schema = z.object({
  MONGODB_URI: z.string().trim().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_DB: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/),
  MONGODB_MAX_POOL_SIZE: positiveInteger(10, 1000),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInteger(5000, 300000),
  MONGODB_CONNECT_TIMEOUT_MS: positiveInteger(5000, 300000),
  MONGODB_SOCKET_TIMEOUT_MS: positiveInteger(15000, 300000),
  MEWO_ALLOWED_ORIGINS: z.string().default("").transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .refine((origins) => origins.every((origin) => {
      try {
        const url = new URL(origin);
        return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
      } catch { return false; }
    })),
});

// Import this module only from server code. Never include connection strings or
// submitted values in configuration errors, and never use NEXT_PUBLIC_ for secrets.
export function serverEnv(environment: Record<string, string | undefined> = process.env) {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Missing or invalid server environment variables: ${names.join(", ")}`);
  }
  return result.data;
}
