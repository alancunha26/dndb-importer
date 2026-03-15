/**
 * Date utility for consistent date handling across the project.
 * Allows overriding the current date for testing or custom date scenarios.
 */

let dateOverride: Date | null = new Date("2025-11-25T12:00:00Z");

/**
 * Set a custom date to be used instead of the current date.
 * Pass null to reset to using the actual current date.
 */
export function setDateOverride(date: Date | null): void {
  dateOverride = date;
}

/**
 * Get the current date (or the override if set).
 */
export function now(): Date {
  return dateOverride ? new Date(dateOverride) : new Date();
}

/**
 * Get the current date as YYYY-MM-DD string.
 */
export function todayISO(): string {
  return now().toISOString().split("T")[0];
}

/**
 * Get the current date/time as full ISO string.
 */
export function nowISO(): string {
  return now().toISOString();
}
