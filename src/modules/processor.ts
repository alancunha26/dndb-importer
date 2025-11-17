/**
 * Processor Module
 * Processes files one at a time and writes immediately to avoid memory bloat
 *
 * Memory-efficient approach:
 * - Parse HTML (in memory briefly)
 * - Convert to Markdown (in memory briefly)
 * - Download images
 * - Write to disk immediately
 * - Store only lightweight WrittenFile
 * - HTML/markdown garbage collected before next file
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join, extname } from "node:path";
import { load } from "cheerio";
import { createTurndownService } from "../turndown";
import { IdGenerator } from "../utils/id-generator";
import type {
  ConversionContext,
  ConversionConfig,
  FileDescriptor,
  FileAnchors,
  ImageDescriptor,
  WrittenFile,
} from "../types";

// ============================================================================
// Sub-process Functions
// ============================================================================

/**
 * Parse HTML file and extract content, anchors, and images using Cheerio
 * This is the ONLY place Cheerio is used - all extraction happens here
 *
 * @param file - File descriptor with source path
 * @param config - Conversion configuration
 * @returns Extracted HTML content, anchors, and image URLs
 */
async function processHtml(
  file: FileDescriptor,
  config: ConversionConfig,
): Promise<{
  htmlContent: string;
  anchors: FileAnchors;
  imageUrls: string[];
}> {
  // 1. Read HTML file from disk
  const html = await readFile(file.sourcePath, config.input.encoding);

  // 2. Parse with Cheerio (ONLY place we use Cheerio)
  const $ = load(html);

  // 3. Extract main content using configured selector
  const content = $(config.html.contentSelector);

  if (content.length === 0) {
    console.warn(
      `Warning: No content found with selector "${config.html.contentSelector}" in ${file.relativePath}`,
    );
    return {
      htmlContent: "",
      anchors: { valid: [], htmlIdToAnchor: {} },
      imageUrls: [],
    };
  }

  // 4. Remove unwanted elements if configured
  if (config.html.removeSelectors.length > 0) {
    config.html.removeSelectors.forEach((selector) => {
      content.find(selector).remove();
    });
  }

  // 5. Extract anchors from headings
  const valid: string[] = [];
  const htmlIdToAnchor: Record<string, string> = {};

  content.find("h1, h2, h3, h4, h5, h6").each((_index, element) => {
    const $heading = $(element);
    const text = $heading.text().trim();
    const htmlId = $heading.attr("id");

    // Generate GitHub-style anchor from heading text
    const anchor = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special chars except spaces and hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

    if (anchor) {
      // Add base anchor
      valid.push(anchor);

      // Add plural/singular variants
      if (anchor.endsWith("s")) {
        valid.push(anchor.slice(0, -1)); // singular
      } else {
        valid.push(anchor + "s"); // plural
      }

      // Map HTML ID to markdown anchor
      if (htmlId) {
        htmlIdToAnchor[htmlId] = anchor;
      }
    }
  });

  // 6. Extract image URLs from <img> tags
  const imageUrls: string[] = [];
  content.find("img").each((_index, element) => {
    const src = $(element).attr("src");
    if (src) {
      imageUrls.push(src);
    }
  });

  // 7. Return extracted data
  return {
    htmlContent: content.html() || "",
    anchors: { valid, htmlIdToAnchor },
    imageUrls,
  };
}

/**
 * Convert HTML to Markdown using Turndown
 * No Cheerio needed - just pure HTML to Markdown conversion
 *
 * @param htmlContent - Extracted HTML content as string
 * @param imageMapping - Map of original image URLs to local paths
 * @param config - Conversion configuration
 * @returns Markdown string
 */
async function processMarkdown(
  htmlContent: string,
  imageMapping: Map<string, string>,
  config: ConversionConfig,
): Promise<string> {
  if (!htmlContent) {
    return "";
  }

  // Convert HTML to Markdown using Turndown with image URL mapping
  const turndown = createTurndownService(config.markdown, imageMapping);
  return turndown.turndown(htmlContent);
}

/**
 * Download images from URL list and build URL mapping
 *
 * @param imageUrls - List of image URLs extracted from HTML
 * @param file - File descriptor
 * @param config - Conversion configuration
 * @returns Object with URL mapping (original URL -> local path) and image descriptors
 */
async function processImages(
  imageUrls: string[],
  file: FileDescriptor,
  config: ConversionConfig,
): Promise<{ mapping: Map<string, string>; images: ImageDescriptor[] }> {
  const mapping = new Map<string, string>();

  if (!config.images.download || imageUrls.length === 0) {
    return { mapping, images: [] }; // Skip if disabled or no images
  }

  const images: ImageDescriptor[] = [];
  const idGenerator = new IdGenerator();

  for (const src of imageUrls) {
    // 1. Generate unique ID for this image
    const uniqueId = idGenerator.generate();
    const extension =
      extname(new URL(src, "https://www.dndbeyond.com").pathname) || ".png";

    // Check if format is supported
    const format = extension.slice(1); // Remove the dot
    if (!config.images.formats.includes(format)) {
      console.warn(`Skipping unsupported image format: ${format} (${src})`);
      continue;
    }

    const localPath = `${uniqueId}${extension}`;
    const outputPath = join(dirname(file.outputPath), localPath);

    const imageDescriptor: ImageDescriptor = {
      originalUrl: src,
      uniqueId,
      extension,
      localPath,
      sourcebook: file.sourcebook,
      downloadStatus: "pending",
    };

    // 2. Download image with retry logic
    try {
      await downloadImageWithRetry(
        src,
        outputPath,
        config.images.retries,
        config.images.timeout,
      );
      imageDescriptor.downloadStatus = "success";

      // 3. Add to URL mapping (original URL -> local path)
      mapping.set(src, localPath);
    } catch (error) {
      imageDescriptor.downloadStatus = "failed";
      imageDescriptor.error = error as Error;
      console.error(`Failed to download image ${src}:`, error);

      // Don't add to mapping if download failed - keep original URL
    }

    images.push(imageDescriptor);
  }

  return { mapping, images };
}

/**
 * Download image with retry logic
 */
async function downloadImageWithRetry(
  url: string,
  outputPath: string,
  retries: number,
  timeout: number,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Download image
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Ensure output directory exists
      await mkdir(dirname(outputPath), { recursive: true });

      // Write file
      await writeFile(outputPath, buffer);

      return; // Success!
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries) {
        // Exponential backoff: wait 1s, 2s, 4s, etc.
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Download failed");
}

/**
 * Build YAML frontmatter for markdown file
 *
 * @param file - File descriptor
 * @param ctx - Conversion context
 * @returns YAML frontmatter as string (includes --- delimiters)
 */
function processFrontmatter(
  file: FileDescriptor,
  ctx: ConversionContext,
): string {
  // 1. Extract title from filename (remove numeric prefix and convert to title case)
  const title = file.filename
    .replace(/^\d+-/, "") // Remove numeric prefix
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // 2. Generate current date in ISO format
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // 3. Find sourcebook for this file
  const sourcebook = ctx.sourcebooks?.find(
    (sb) => sb.sourcebook === file.sourcebook,
  );

  // 4. Generate tags
  const tags = [
    "dnd5e/source",
    `dnd5e/${file.sourcebook}`,
    sourcebook
      ? `dnd5e/${sourcebook.title.toLowerCase().replace(/\s+/g, "-")}`
      : null,
  ].filter(Boolean); // Remove null values

  // 5. Build YAML frontmatter
  const frontmatter = [
    "---",
    `title: "${title}"`,
    `date: ${date}`,
    `tags:`,
    ...tags.map((tag) => `  - ${tag}`),
    "---",
    "",
  ].join("\n");

  return frontmatter;
}

/**
 * Build navigation links (prev/index/next)
 *
 * @param file - Current file descriptor
 * @param ctx - Conversion context (has sourcebooks with file ordering)
 * @returns Navigation markdown string
 */
function processNavigation(
  file: FileDescriptor,
  ctx: ConversionContext,
): string {
  // 1. Find the sourcebook for this file
  const sourcebook = ctx.sourcebooks?.find(
    (sb) => sb.sourcebook === file.sourcebook,
  );

  if (!sourcebook) {
    return ""; // No navigation if sourcebook not found
  }

  // 2. Find current file's index in the sourcebook
  const currentIndex = sourcebook.files.findIndex(
    (f) => f.uniqueId === file.uniqueId,
  );

  if (currentIndex === -1) {
    return ""; // File not found in sourcebook
  }

  // 3. Get previous, index, and next files
  const prevFile = currentIndex > 0 ? sourcebook.files[currentIndex - 1] : null;
  const nextFile =
    currentIndex < sourcebook.files.length - 1
      ? sourcebook.files[currentIndex + 1]
      : null;

  // 4. Build navigation links
  const links: string[] = [];

  if (prevFile) {
    const prevTitle = prevFile.filename
      .replace(/^\d+-/, "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    links.push(`← [${prevTitle}](${prevFile.uniqueId}.md)`);
  }

  // Index link
  links.push(`[Index](${sourcebook.id}.md)`);

  if (nextFile) {
    const nextTitle = nextFile.filename
      .replace(/^\d+-/, "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    links.push(`[${nextTitle}](${nextFile.uniqueId}.md) →`);
  }

  // 5. Return navigation as markdown
  return `${links.join(" | ")}\n\n---\n\n`;
}

/**
 * Assemble final document and write to disk
 *
 * @param file - File descriptor
 * @param frontmatter - YAML frontmatter string
 * @param navigation - Navigation links string
 * @param markdown - Main markdown content
 * @param anchors - FileAnchors for link resolution
 * @param ctx - Conversion context
 * @returns WrittenFile with path and anchors
 */
async function processDocument(
  file: FileDescriptor,
  frontmatter: string,
  navigation: string,
  markdown: string,
  anchors: FileAnchors,
  ctx: ConversionContext,
): Promise<WrittenFile> {
  // 1. Assemble final markdown document
  const parts: string[] = [];

  // Add frontmatter if enabled
  if (ctx.config.markdown.frontmatter) {
    parts.push(frontmatter);
  }

  // Add navigation if enabled
  if (ctx.config.markdown.navigation) {
    parts.push(navigation);
  }

  // Add main content
  parts.push(markdown);

  const finalMarkdown = parts.join("\n");

  // 2. Ensure output directory exists
  await mkdir(dirname(file.outputPath), { recursive: true });

  // 3. Write to disk
  await writeFile(file.outputPath, finalMarkdown, "utf-8");

  // 4. Return WrittenFile with lightweight metadata
  return {
    descriptor: file,
    path: file.outputPath,
    anchors,
  };
}

/**
 * Generate index files for all sourcebooks
 *
 * @param ctx - Conversion context (has sourcebooks with files)
 */
async function processIndexes(ctx: ConversionContext): Promise<void> {
  if (!ctx.sourcebooks || !ctx.config.output.createIndex) {
    return; // Skip if no sourcebooks or index creation disabled
  }

  for (const sourcebook of ctx.sourcebooks) {
    // 1. Build frontmatter for index
    const frontmatter = [
      "---",
      `title: "${sourcebook.title}"`,
      `date: ${new Date().toISOString().split("T")[0]}`,
      `tags:`,
      `  - dnd5e/index`,
      `  - dnd5e/${sourcebook.sourcebook}`,
      "---",
      "",
    ].join("\n");

    // 2. Build file list
    const fileList = [
      `# ${sourcebook.title}`,
      "",
      "## Contents",
      "",
      ...sourcebook.files.map((file, index) => {
        const title = file.filename
          .replace(/^\d+-/, "")
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        return `${index + 1}. [${title}](${file.uniqueId}.md)`;
      }),
      "",
    ].join("\n");

    // 3. Assemble index markdown
    const parts: string[] = [];

    if (ctx.config.markdown.frontmatter) {
      parts.push(frontmatter);
    }

    parts.push(fileList);

    const indexMarkdown = parts.join("\n");

    // 4. Ensure output directory exists and write index
    await mkdir(dirname(sourcebook.outputPath), { recursive: true });
    await writeFile(sourcebook.outputPath, indexMarkdown, "utf-8");

    console.log(`Created index for ${sourcebook.title}`);
  }
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Processes all scanned files and writes them to disk
 *
 * Reads from context:
 * - files
 * - sourcebooks (for navigation)
 * - config
 *
 * Writes to context:
 * - writtenFiles: Array of WrittenFile with paths and anchors (lightweight)
 */
export async function process(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.sourcebooks) {
    throw new Error("Scanner must run before processor");
  }

  console.log(`Processing ${ctx.files.length} files...`);

  const writtenFiles: WrittenFile[] = [];

  // Process each file one at a time (memory-efficient)
  for (const file of ctx.files) {
    // 1. Parse HTML and extract content, anchors, and image URLs (ONLY place Cheerio is used)
    const { htmlContent, anchors, imageUrls } = await processHtml(
      file,
      ctx.config,
    );

    // 2. Download images and build URL mapping (original URL -> local path)
    const { mapping: imageMapping } = await processImages(
      imageUrls,
      file,
      ctx.config,
    );

    // 3. Convert HTML to Markdown using Turndown with image URL mapping
    const markdown = await processMarkdown(
      htmlContent,
      imageMapping,
      ctx.config,
    );

    // 4. Build frontmatter
    const frontmatter = processFrontmatter(file, ctx);

    // 5. Build navigation links
    const navigation = processNavigation(file, ctx);

    // 6. Assemble and write document
    const writtenFile = await processDocument(
      file,
      frontmatter,
      navigation,
      markdown,
      anchors,
      ctx,
    );

    writtenFiles.push(writtenFile);

    // All strings are garbage collected here before next iteration
  }

  // 7. Generate index files
  await processIndexes(ctx);

  // Write to context
  ctx.writtenFiles = writtenFiles;
}
