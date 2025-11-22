/**
 * Fetch a D&D Beyond listing page with retry logic
 */

export interface FetchOptions {
  timeout?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;

/**
 * Fetch HTML content from a URL with retry logic and exponential backoff
 */
export async function fetchListingPage(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}
