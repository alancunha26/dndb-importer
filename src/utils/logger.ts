/**
 * Logger Utility
 * Handles console output with different log levels
 */

export class Logger {
  constructor(private level: "debug" | "info" | "warn" | "error" = "info") {}

  debug(message: string): void {
    if (this.level === "debug") {
      console.log(`[DEBUG] ${message}`);
    }
  }

  info(message: string): void {
    if (["debug", "info"].includes(this.level)) {
      console.log(`[INFO] ${message}`);
    }
  }

  warn(message: string): void {
    if (["debug", "info", "warn"].includes(this.level)) {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`);
    if (error) {
      console.error(error);
    }
  }
}
