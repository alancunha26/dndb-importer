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

import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { dirname, join, extname } from "node:path";
import { load } from "cheerio";
import { createTurndownService } from "../turndown";
import { loadIndexTemplate, loadFileTemplate } from "../templates";
import { IdGenerator } from "../utils/id-generator";
import { loadMapping, saveMapping } from "../utils/mapping";
import { fileExists } from "../utils/fs";
import { filenameToTitle } from "../utils/string";
import type {
  ConversionContext,
  ConversionConfig,
  FileDescriptor,
  FileAnchors,
  ImageDescriptor,
  ImageMapping,
  IndexTemplateContext,
  FileTemplateContext,
  SourcebookInfo,
  WrittenFile,
} from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

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
  title: string;
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
      title: "",
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

  // 5. Preprocess HTML structure for D&D Beyond patterns
  // Fix nested lists BEFORE Turndown conversion (not as a Turndown rule)
  // This is preprocessing because:
  // - D&D Beyond uses a specific HTML pattern (lists as siblings, not children)
  // - Turndown needs proper HTML structure to generate correct markdown
  // - DOM manipulation during Turndown conversion can cause content loss
  content
    .find("ol > ul, ol > ol, ul > ul, ul > ol")
    .each((_index: number, element: any) => {
      const $nestedList = $(element);
      const $parent = $nestedList.parent();

      if (!$parent.is("ol, ul")) return;

      const $previousLi = $nestedList.prev("li");
      if ($previousLi.length === 0) return;

      $nestedList.remove();
      $previousLi.append($nestedList);
    });

  // 6. Extract title from first H1 and anchors from all headings
  let title = "";
  const valid: string[] = [];
  const htmlIdToAnchor: Record<string, string> = {};

  content.find("h1, h2, h3, h4, h5, h6").each((_index, element) => {
    const $heading = $(element);
    const text = $heading.text().trim();
    const htmlId = $heading.attr("id");

    // Extract title from first H1
    if (!title && $heading.is("h1")) {
      title = text;
    }

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

  // 7. Extract image URLs from <img> tags
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
    title,
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
 * @param persistentMapping - Existing image mapping (URL -> filename)
 * @returns Object with URL mapping, image descriptors, and updated persistent mapping
 */
async function processImages(
  imageUrls: string[],
  file: FileDescriptor,
  config: ConversionConfig,
  persistentMapping: ImageMapping,
): Promise<{
  mapping: Map<string, string>;
  images: ImageDescriptor[];
  updatedMapping: ImageMapping;
}> {
  const mapping = new Map<string, string>();
  const updatedMapping = { ...persistentMapping };

  if (!config.images.download || imageUrls.length === 0) {
    return { mapping, images: [], updatedMapping }; // Skip if disabled or no images
  }

  const images: ImageDescriptor[] = [];
  const idGenerator = new IdGenerator();

  // Register all existing IDs from persistent mapping to avoid collisions
  for (const filename of Object.values(persistentMapping)) {
    // Extract ID from filename (e.g., "a3f9.png" -> "a3f9")
    const id = filename.split(".")[0];
    idGenerator.register(id);
  }

  let cachedCount = 0;
  let downloadedCount = 0;

  for (const src of imageUrls) {
    const extension =
      extname(new URL(src, "https://www.dndbeyond.com").pathname) || ".png";

    // Check if format is supported
    const format = extension.slice(1); // Remove the dot
    if (!config.images.formats.includes(format)) {
      console.warn(`Skipping unsupported image format: ${format} (${src})`);
      continue;
    }

    // 1. Check if this URL already exists in persistent mapping
    let uniqueId: string;
    let localPath: string;

    if (persistentMapping[src]) {
      // Reuse existing filename from mapping
      localPath = persistentMapping[src];
      uniqueId = localPath.split(".")[0]; // Extract ID from filename
    } else {
      // Generate new ID and filename
      uniqueId = idGenerator.generate();
      localPath = `${uniqueId}${extension}`;

      // Add to updated mapping
      updatedMapping[src] = localPath;
    }

    const outputPath = join(dirname(file.outputPath), localPath);

    const imageDescriptor: ImageDescriptor = {
      originalUrl: src,
      uniqueId,
      extension,
      localPath,
      sourcebook: file.sourcebook,
      downloadStatus: "pending",
    };

    // 2. Check if image file already exists (caching)
    const exists = await fileExists(outputPath);

    if (exists) {
      // Image already downloaded - skip download
      imageDescriptor.downloadStatus = "success";
      mapping.set(src, localPath);
      cachedCount++;
    } else {
      // 3. Download image with retry logic
      try {
        await downloadImageWithRetry(
          src,
          outputPath,
          config.images.retries,
          config.images.timeout,
        );
        imageDescriptor.downloadStatus = "success";

        // 4. Add to URL mapping (original URL -> local path)
        mapping.set(src, localPath);
        downloadedCount++;
      } catch (error) {
        imageDescriptor.downloadStatus = "failed";
        imageDescriptor.error = error as Error;
        console.error(`Failed to download image ${src}:`, error);
      }
    }

    images.push(imageDescriptor);
  }

  // Log summary if in debug mode
  if (config.logging.level === "debug" && imageUrls.length > 0) {
    console.log(
      `  Images: ${downloadedCount} downloaded, ${cachedCount} cached`,
    );
  }

  return { mapping, images, updatedMapping };
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
 * Build navigation links (prev/index/next)
 *
 * @param file - Current file descriptor
 * @param ctx - Conversion context (has sourcebooks with file ordering)
 * @returns Navigation links object for template
 */
function processNavigation(
  file: FileDescriptor,
  ctx: ConversionContext,
): { prev?: string; index: string; next?: string } {
  // 1. Find the sourcebook for this file
  const sourcebook = ctx.sourcebooks?.find(
    (sb) => sb.sourcebook === file.sourcebook,
  );

  if (!sourcebook) {
    return { index: "[Index](index.md)" }; // Fallback if sourcebook not found
  }

  // 2. Find current file's index in the sourcebook
  const currentIndex = sourcebook.files.findIndex(
    (f) => f.uniqueId === file.uniqueId,
  );

  if (currentIndex === -1) {
    return { index: `[Index](${sourcebook.id}${ctx.config.output.extension})` };
  }

  // 3. Get previous, index, and next files
  const prevFile = currentIndex > 0 ? sourcebook.files[currentIndex - 1] : null;
  const nextFile =
    currentIndex < sourcebook.files.length - 1
      ? sourcebook.files[currentIndex + 1]
      : null;

  // 4. Build navigation links object
  const navigation: { prev?: string; index: string; next?: string } = {
    index: `[Index](${sourcebook.id}${ctx.config.output.extension})`,
  };

  if (prevFile) {
    const prevTitle = filenameToTitle(prevFile.filename);
    navigation.prev = `← [${prevTitle}](${prevFile.uniqueId}${ctx.config.output.extension})`;
  }

  if (nextFile) {
    const nextTitle = filenameToTitle(nextFile.filename);
    navigation.next = `[${nextTitle}](${nextFile.uniqueId}${ctx.config.output.extension}) →`;
  }

  return navigation;
}

/**
 * Assemble final document using template and write to disk
 *
 * @param file - File descriptor
 * @param markdown - Main markdown content
 * @param anchors - FileAnchors for link resolution
 * @param sourcebook - Sourcebook info
 * @param ctx - Conversion context
 * @returns WrittenFile with path and anchors
 */
async function processDocument(
  file: FileDescriptor,
  title: string,
  markdown: string,
  anchors: FileAnchors,
  sourcebook: SourcebookInfo,
  ctx: ConversionContext,
): Promise<WrittenFile> {
  // 1. Load template (sourcebook-specific > global > default)
  const template = await loadFileTemplate(
    sourcebook.templates.file,
    ctx.globalTemplates?.file ?? null,
    ctx.config.markdown,
  );

  // 2. Build template context
  const context: FileTemplateContext = {
    title,
    date: new Date().toISOString().split("T")[0],
    tags: ["dnd5e/chapter"],
    sourcebook: {
      title: sourcebook.title,
      edition: sourcebook.metadata.edition,
      author: sourcebook.metadata.author,
      metadata: sourcebook.metadata,
    },
    navigation: processNavigation(file, ctx),
    content: markdown,
  };

  // 4. Render template
  const finalMarkdown = template(context);

  // 5. Ensure output directory exists
  await mkdir(dirname(file.outputPath), { recursive: true });

  // 6. Write to disk
  await writeFile(file.outputPath, finalMarkdown, "utf-8");

  // 7. Return WrittenFile with lightweight metadata
  return {
    descriptor: file,
    path: file.outputPath,
    title,
    anchors,
  };
}

/**
 * Process a cover image for a sourcebook
 *
 * @param sourcebook - Sourcebook info with metadata
 * @param imageMapping - Current image mapping
 * @param idGenerator - ID generator for new images
 * @param ctx - Conversion context
 * @returns Updated cover image filename (with unique ID) or undefined
 */
async function processCoverImage(
  sourcebook: SourcebookInfo,
  imageMapping: ImageMapping,
  idGenerator: IdGenerator,
  ctx: ConversionContext,
): Promise<string | undefined> {
  const { coverImage } = sourcebook.metadata;

  if (!coverImage) {
    return undefined;
  }

  // Build path to cover image in input directory
  const inputPath = join(
    ctx.config.input.directory,
    sourcebook.sourcebook,
    coverImage,
  );

  // Check if cover image exists
  if (!(await fileExists(inputPath))) {
    console.warn(`Cover image not found: ${inputPath}`);
    return undefined;
  }

  // Use input path as key for mapping (similar to how we handle regular images)
  const mappingKey = `cover:${sourcebook.sourcebook}/${coverImage}`;

  // Check if we already have an ID for this cover image
  let uniqueId: string;
  if (imageMapping[mappingKey]) {
    uniqueId = imageMapping[mappingKey].split(".")[0]; // Extract ID from filename
  } else {
    // Generate new unique ID
    uniqueId = idGenerator.generate();
  }

  // Get file extension
  const extension = extname(coverImage);
  const localFilename = `${uniqueId}${extension}`;

  // Build output path
  const outputPath = join(
    ctx.config.output.directory,
    sourcebook.sourcebook,
    localFilename,
  );

  // Copy cover image to output directory
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(inputPath, outputPath);

    // Update mapping
    imageMapping[mappingKey] = localFilename;

    return localFilename;
  } catch (error) {
    console.error(`Failed to copy cover image ${inputPath}:`, error);
    return undefined;
  }
}

/**
 * Generate index files for all sourcebooks
 *
 * @param ctx - Conversion context (has sourcebooks with files)
 * @param imageMapping - Current image mapping (will be updated with cover images)
 * @param idGenerator - ID generator for cover images
 */
async function processIndexes(
  ctx: ConversionContext,
  writtenFiles: WrittenFile[],
  imageMapping: ImageMapping,
  idGenerator: IdGenerator,
): Promise<void> {
  if (!ctx.sourcebooks || !ctx.config.output.createIndex) {
    return; // Skip if no sourcebooks or index creation disabled
  }

  // Build map of file uniqueId -> title from writtenFiles
  const titleMap = new Map<string, string>();
  for (const writtenFile of writtenFiles) {
    titleMap.set(writtenFile.descriptor.uniqueId, writtenFile.title);
  }

  for (const sourcebook of ctx.sourcebooks) {
    // 1. Process cover image if present
    const processedCoverImage = await processCoverImage(
      sourcebook,
      imageMapping,
      idGenerator,
      ctx,
    );

    // 2. Load template (sourcebook-specific > global > default)
    const template = await loadIndexTemplate(
      sourcebook.templates.index,
      ctx.globalTemplates?.index ?? null,
      ctx.config.markdown,
    );

    // 3. Build template context
    const context: IndexTemplateContext = {
      title: sourcebook.title,
      edition: sourcebook.metadata.edition,
      description: sourcebook.metadata.description,
      author: sourcebook.metadata.author,
      coverImage: processedCoverImage, // Use processed filename with unique ID
      metadata: sourcebook.metadata,
      files: sourcebook.files.map((file) => ({
        title: titleMap.get(file.uniqueId) || "",
        filename: `${file.uniqueId}${ctx.config.output.extension}`,
        uniqueId: file.uniqueId,
      })),
    };

    // 4. Add date to context for template
    const templateContext = {
      ...context,
      date: new Date().toISOString().split("T")[0],
    };

    // 5. Render template
    const indexMarkdown = template(templateContext);

    // 6. Ensure output directory exists and write index
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

  // Load persistent image mapping from images.json (if exists)
  let imageMapping = await loadMapping(
    ctx.config.output.directory,
    "images.json",
  );

  // Create ID generator and register existing IDs from mapping
  const idGenerator = new IdGenerator();
  for (const filename of Object.values(imageMapping)) {
    const id = filename.split(".")[0]; // Extract ID from filename
    idGenerator.register(id);
  }

  // Process each file one at a time (memory-efficient)
  for (const file of ctx.files) {
    // 1. Find sourcebook for this file
    const sourcebook = ctx.sourcebooks?.find(
      (sb) => sb.sourcebook === file.sourcebook,
    );

    if (!sourcebook) {
      console.warn(`Skipping file ${file.relativePath}: sourcebook not found`);
      continue;
    }

    // 2. Parse HTML and extract content, title, anchors, and image URLs (ONLY place Cheerio is used)
    const { htmlContent, title, anchors, imageUrls } = await processHtml(
      file,
      ctx.config,
    );

    // 3. Download images and build URL mapping (original URL -> local path)
    const { mapping: urlMapping, updatedMapping } = await processImages(
      imageUrls,
      file,
      ctx.config,
      imageMapping,
    );

    // Update persistent mapping for next file
    imageMapping = updatedMapping;

    // 4. Convert HTML to Markdown using Turndown with image URL mapping
    const markdown = await processMarkdown(htmlContent, urlMapping, ctx.config);

    // 5. Assemble and write document using template
    const writtenFile = await processDocument(
      file,
      title,
      markdown,
      anchors,
      sourcebook,
      ctx,
    );

    writtenFiles.push(writtenFile);

    // All strings are garbage collected here before next iteration
  }

  // 7. Generate index files (may add cover images to imageMapping)
  await processIndexes(ctx, writtenFiles, imageMapping, idGenerator);

  // 8. Save updated image mapping to images.json (includes cover images)
  await saveMapping(ctx.config.output.directory, "images.json", imageMapping);

  // Write to context
  ctx.writtenFiles = writtenFiles;
}
