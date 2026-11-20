import { z } from "zod";

export const ConfigSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  BMC_PROVIDER_MODE: z.enum(["mock", "helix"]).default("mock"),
  BMC_BASE_URL: z.string().default(""),
  BMC_USERNAME: z.string().default(""),
  BMC_PASSWORD: z.string().default(""),

  BMC_SYNC_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  BMC_SYNC_INTERVAL_MINUTES: z
    .string()
    .default("5")
    .transform((val) => parseInt(val, 10) || 5),
  BMC_RETRY_LIMIT: z
    .string()
    .default("3")
    .transform((val) => parseInt(val, 10) || 3),
  BMC_RETRY_BASE_DELAY_SECONDS: z
    .string()
    .default("30")
    .transform((val) => parseInt(val, 10) || 30),

  DEFAULT_TIME_ZONE: z.string().default("Asia/Kolkata"),
  MISSING_ROSTER_POLICY: z
    .enum(["TAKE_NO_ACTION", "KEEP_CURRENT_BMC_STATE", "SET_UNAVAILABLE"])
    .default("TAKE_NO_ACTION"),
  ON_CALL_COUNTS_AS_AVAILABLE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  DEVELOPMENT_AUTH_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  SYNC_DRY_RUN: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Invalid environment configuration, falling back to defaults:", parsed.error);
    cachedConfig = ConfigSchema.parse({});
  } else {
    cachedConfig = parsed.data;
  }
  return cachedConfig;
}
