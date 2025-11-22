import { isImageUrl } from "./is-image-url";
import { isEntityUrl } from "./is-entity-url";
import { isSourceUrl } from "./is-source-url";
import { isDndBeyondUrl } from "./is-dnd-beyond-url";

const LOCAL_MD_FILE_PATTERN = /^[a-z0-9]{4}\.md/;

/**
 * Check if a URL should be resolved by the resolver module
 *
 * @example
 * shouldResolveUrl("#fireball") // => true (internal anchor)
 * shouldResolveUrl("https://www.dndbeyond.com/sources/...") // => true
 * shouldResolveUrl("https://example.com") // => false (external)
 */
export function shouldResolveUrl(url: string): boolean {
  if (url.startsWith("#")) {
    return true;
  }

  if (url.endsWith(".md") || LOCAL_MD_FILE_PATTERN.test(url)) {
    return false;
  }

  if (isImageUrl(url)) {
    return false;
  }

  if (isDndBeyondUrl(url)) {
    return true;
  }

  if (isSourceUrl(url) || isEntityUrl(url)) {
    return true;
  }

  return false;
}
