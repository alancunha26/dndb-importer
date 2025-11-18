/* eslint-disable @typescript-eslint/no-unused-vars */

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
import { filenameToTitle, isImageUrl } from "../utils/string";
import type {
  ConversionContext,
  FileDescriptor,
  FileAnchors,
  IndexTemplateContext,
  FileTemplateContext,
  SourcebookInfo,
} from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Main Orchestrator (Factory Function)
// ============================================================================

/**
 * Processes all scanned files and writes them to disk
 * Enriches FileDescriptor objects with title, anchors, and written flag
 *
 * This function acts as a factory that creates inner functions with shared access
 * to common variables, eliminating argument drilling.
 *
 * Reads from context:
 * - files (flat list of all files)
 * - sourcebooks (metadata only)
 * - config
 *
 * Mutates:
 * - FileDescriptor objects in files array (adds title, anchors, written)
 */
export async function process(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.sourcebooks) {
    throw new Error("Scanner must run before processor");
  }

  // ============================================================================
  // Shared Variables (accessible to all inner functions via closure)
  // ============================================================================

  const { config, files, sourcebooks, globalTemplates } = ctx;

  // Load persistent image mapping from images.json (if exists)
  let imageMapping = await loadMapping(config.output.directory, "images.json");

  // Create ID generator and register existing IDs from mapping
  const idGenerator = new IdGenerator();
  for (const filename of Object.values(imageMapping)) {
    const id = filename.split(".")[0];
    idGenerator.register(id);
  }

  // ============================================================================
  // Inner Functions (created by factory, share variables via closure)
  // ============================================================================

  /**
   * Parse HTML file and extract content, anchors, and images using Cheerio
   * This is the ONLY place Cheerio is used - all extraction happens here
   */
  async function processHtml(file: FileDescriptor): Promise<{
    content: string;
    title: string;
    anchors: FileAnchors;
    images: string[];
  }> {
    // 1. Read HTML file from disk
    const html = await readFile(file.sourcePath, config.input.encoding);

    // 2. Parse with Cheerio (ONLY place we use Cheerio)
    const $ = load(html);

    // 3. Extract main content using configured selector
    const content = $(config.html.contentSelector);

    if (content.length === 0) {
      return {
        content: "",
        title: "",
        anchors: { valid: [], htmlIdToAnchor: {} },
        images: [],
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

    // 8. Extract alternate image URLs from figcaption links (generic pattern)
    // Finds any <a> in <figcaption> that links to an image file
    content.find("figcaption a").each((_index, element) => {
      const href = $(element).attr("href");
      if (href && isImageUrl(href)) {
        imageUrls.push(href);
      }
    });

    // 9. Return extracted data
    return {
      content: content.html() || "",
      title,
      anchors: { valid, htmlIdToAnchor },
      images: imageUrls,
    };
  }

  /**
   * Convert HTML to Markdown using Turndown
   * No Cheerio needed - just pure HTML to Markdown conversion
   */
  async function processMarkdown(htmlContent: string): Promise<string> {
    if (!htmlContent) {
      return "";
    }

    // Convert HTML to Markdown using Turndown with image URL mapping
    const urlMapping = new Map(Object.entries(imageMapping));
    const turndown = createTurndownService(config.markdown, urlMapping);
    return turndown.turndown(htmlContent);
  }

  /**
   * Download images from URL list and build URL mapping
   */
  async function processImages(
    file: FileDescriptor,
    images: string[],
  ): Promise<void> {
    if (!config.images.download || images.length === 0) {
      return;
    }

    for (const src of images) {
      const extension =
        extname(new URL(src, "https://www.dndbeyond.com").pathname) || ".png";

      const format = extension.slice(1);
      if (!config.images.formats.includes(format)) {
        continue;
      }

      const path = imageMapping[src] ?? `${idGenerator.generate()}${extension}`;
      const outputPath = join(dirname(file.outputPath), path);
      const imageExists = await fileExists(outputPath);

      if (!imageExists) {
        try {
          await downloadImageWithRetry(
            src,
            outputPath,
            config.images.retries,
            config.images.timeout,
          );
        } catch (error) {
          // Silently continue - image download failures don't stop processing
        }
      }

      // NOTE: Mutates mapping with updated path
      imageMapping[src] = path;
    }
  }

  /**
   * Build navigation links (prev/index/next)
   */
  function processNavigation(file: FileDescriptor): {
    prev?: string;
    index: string;
    next?: string;
  } {
    // 1. Find the sourcebook for this file
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);

    if (!sourcebook) {
      return { index: "[Index](index.md)" }; // Fallback if sourcebook not found
    }

    // 2. Get all files for this sourcebook in order
    const sourcebookFiles = files.filter(
      (f) => f.sourcebookId === file.sourcebookId,
    );

    // 3. Find current file's index in the sourcebook
    const currentIndex = sourcebookFiles.findIndex(
      (f) => f.uniqueId === file.uniqueId,
    );

    if (currentIndex === -1) {
      return { index: `[Index](${sourcebook.id}${config.output.extension})` };
    }

    // 4. Get previous, index, and next files
    const prevFile =
      currentIndex > 0 ? sourcebookFiles[currentIndex - 1] : null;
    const nextFile =
      currentIndex < sourcebookFiles.length - 1
        ? sourcebookFiles[currentIndex + 1]
        : null;

    // 5. Build navigation links object
    const navigation: { prev?: string; index: string; next?: string } = {
      index: `[Index](${sourcebook.id}${config.output.extension})`,
    };

    if (prevFile) {
      const prevTitle = filenameToTitle(prevFile.filename);
      navigation.prev = `← [${prevTitle}](${prevFile.uniqueId}${config.output.extension})`;
    }

    if (nextFile) {
      const nextTitle = filenameToTitle(nextFile.filename);
      navigation.next = `[${nextTitle}](${nextFile.uniqueId}${config.output.extension}) →`;
    }

    return navigation;
  }

  /**
   * Assemble final document using template and write to disk
   * Enriches the FileDescriptor with title, anchors, and written flag
   */
  async function processDocument(
    file: FileDescriptor,
    markdown: string,
    sourcebook: SourcebookInfo,
  ): Promise<void> {
    // 1. Load template (sourcebook-specific > global > default)
    const template = await loadFileTemplate(
      sourcebook.templates.file,
      globalTemplates?.file ?? null,
      config.markdown,
    );

    // 2. Build template context
    const context: FileTemplateContext = {
      title: file.title || "",
      date: new Date().toISOString().split("T")[0],
      tags: ["dnd5e/chapter"],
      sourcebook: {
        title: sourcebook.title,
        edition: sourcebook.metadata.edition,
        author: sourcebook.metadata.author,
        metadata: sourcebook.metadata,
      },
      navigation: processNavigation(file),
      content: markdown,
    };

    // 4. Render template
    const finalMarkdown = template(context);

    // 5. Ensure output directory exists
    await mkdir(dirname(file.outputPath), { recursive: true });

    // 6. Write to disk
    await writeFile(file.outputPath, finalMarkdown, "utf-8");
  }

  /**
   * Process a cover image for a sourcebook
   */
  async function processCoverImage(
    sourcebook: SourcebookInfo,
  ): Promise<string | undefined> {
    const { coverImage } = sourcebook.metadata;

    if (!coverImage) {
      return undefined;
    }

    // Build path to cover image in input directory
    const inputPath = join(
      config.input.directory,
      sourcebook.sourcebook,
      coverImage,
    );

    // Check if cover image exists
    if (!(await fileExists(inputPath))) {
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
    const outputPath = join(config.output.directory, localFilename);

    // Copy cover image to output directory
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(inputPath, outputPath);

      // NOTE: Mutates image mapping with cover image
      imageMapping[mappingKey] = localFilename;

      return localFilename;
    } catch (error) {
      // Silently continue - cover image copy failures don't stop processing
      return undefined;
    }
  }

  /**
   * Generate index files for all sourcebooks
   */
  async function processIndexes(): Promise<void> {
    if (!sourcebooks || !config.output.createIndex) {
      return; // Skip if no sourcebooks or index creation disabled
    }

    for (const sourcebook of sourcebooks) {
      // 1. Process cover image if present
      const processedCoverImage = await processCoverImage(sourcebook);

      // 2. Load template (sourcebook-specific > global > default)
      const template = await loadIndexTemplate(
        sourcebook.templates.index,
        globalTemplates?.index ?? null,
        config.markdown,
      );

      // 3. Get all files for this sourcebook (should have title from processing)
      const sourcebookFiles = files.filter(
        (f) => f.sourcebookId === sourcebook.id,
      );

      // 4. Build template context
      const context: IndexTemplateContext = {
        title: sourcebook.title,
        date: new Date().toISOString().split("T")[0],
        edition: sourcebook.metadata.edition,
        description: sourcebook.metadata.description,
        author: sourcebook.metadata.author,
        coverImage: processedCoverImage, // Use processed filename with unique ID
        metadata: sourcebook.metadata,
        files: sourcebookFiles.map((file) => ({
          title: file.title || "", // Title should be set by processor
          filename: `${file.uniqueId}${config.output.extension}`,
          uniqueId: file.uniqueId,
        })),
      };

      // 5. Render template
      const indexMarkdown = template(context);

      // 6. Ensure output directory exists and write index
      await mkdir(dirname(sourcebook.outputPath), { recursive: true });
      await writeFile(sourcebook.outputPath, indexMarkdown, "utf-8");
    }
  }

  // ============================================================================
  // Main Processing Logic
  // ============================================================================

  // Process each file one at a time (memory-efficient)
  for (const file of files) {
    // 1. Find sourcebook for this file
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);
    if (!sourcebook) continue;

    // 2. Parse HTML and extract content, title, anchors, and image URLs (ONLY place Cheerio is used)
    const { content, title, anchors, images } = await processHtml(file);
    file.anchors = anchors;
    file.title = title;

    // 3. Download images and build URL mapping (original URL -> local path)
    await processImages(file, images);

    // 4. Convert HTML to Markdown using Turndown with image URL mapping
    const markdown = await processMarkdown(content);

    // 5. Assemble and write document using template (enriches FileDescriptor)
    await processDocument(file, markdown, sourcebook);
    file.written = true;
  }

  // 6. Save updated image mapping to images.json (includes cover images)
  await saveMapping(config.output.directory, "images.json", imageMapping);

  // 7. Generate index files
  await processIndexes();
}
