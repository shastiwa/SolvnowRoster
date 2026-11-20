export class SafeLogger {
  private static maskSensitive(data: unknown): unknown {
    if (typeof data !== "object" || data === null) {
      if (typeof data === "string") {
        return SafeLogger.maskString(data);
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => SafeLogger.maskSensitive(item));
    }

    const maskedObj: Record<string, unknown> = {};
    const sensitiveKeys = [
      "password",
      "token",
      "jwt",
      "secret",
      "authorization",
      "cookie",
      "apikey",
      "key",
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        maskedObj[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        maskedObj[key] = SafeLogger.maskSensitive(value);
      } else if (typeof value === "string") {
        maskedObj[key] = SafeLogger.maskString(value);
      } else {
        maskedObj[key] = value;
      }
    }

    return maskedObj;
  }

  private static maskString(str: string): string {
    // Mask potential JWT tokens
    return str.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "Bearer [REDACTED_JWT]");
  }

  public static info(message: string, context?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        context: context ? SafeLogger.maskSensitive(context) : undefined,
      })
    );
  }

  public static warn(message: string, context?: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        message,
        context: context ? SafeLogger.maskSensitive(context) : undefined,
      })
    );
  }

  public static error(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ): void {
    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error;

    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        error: errorDetails,
        context: context ? SafeLogger.maskSensitive(context) : undefined,
      })
    );
  }
}
