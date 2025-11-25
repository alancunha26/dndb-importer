/**
 * Processor Module
 * Processes files one at a time and writes immediately to avoid memory bloat
 */

import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { dirname, join, extname } from "node:path";
import { load } from "cheerio";
import type { AnyNode } from "domhandler";
import { createTurndownService } from "../turndown";
import {
  loadMapping,
  saveMapping,
  fileExists,
  filenameToTitle,
  isImageUrl,
  extractIdFromFilename,
  generateAnchor,
  loadIndexTemplate,
  loadFileTemplate,
} from "../utils";
import type {
  ConversionContext,
  FileDescriptor,
  FileAnchors,
  IndexTemplateContext,
  FileTemplateContext,
  SourcebookInfo,
  SourceData,
} from "../types";

// ============================================================================
// Main Processor Function
// ============================================================================

export async function process(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.sourcebooks) {
    throw new Error("Scanner must run before processor");
  }

  // ============================================================================
  // Shared State (closure variables)
  // ============================================================================

  const { config, files, sourcebooks, globalTemplates, tracker } = ctx;
  const imageMappingPath = join(config.output, "images.json");
  const imageMapping = await loadMapping(imageMappingPath);

  /**
   * Extract slug from book URL (e.g., /sources/dnd/phb-2024 -> phb-2024)
   */
  function extractSlugFromUrl(bookUrl: string): string | null {
    const match = bookUrl.match(/\/sources\/dnd\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Get source data by slug from config
   */
  function getSourceBySlug(slug: string): SourceData | undefined {
    return config.sources[slug];
  }

  // Register existing IDs with the context's generator
  for (const filename of Object.values(imageMapping)) {
    const id = filename.replace(/\.[^.]+$/, ""); // Remove extension
    ctx.idGenerator.register(id);
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function downloadImage(url: string, outputPath: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.images.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          config.images.timeout,
        );

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, buffer);
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < config.images.retries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error("Download failed");
  }

  // ============================================================================
  // Processing Functions
  // ============================================================================

  async function parseHtml(file: FileDescriptor): Promise<{
    content: string;
    title: string;
    anchors: FileAnchors;
    url: string | null;
    bookUrl: string | null;
    bookTitle: string | null;
    images: string[];
  }> {
    const html = await readFile(file.inputPath, "utf-8");
    const $ = load(html);

    // Extract canonical URL
    let canonicalUrl: string | null = null;
    let bookUrl: string | null = null;
    const canonical = $('link[rel="canonical"]').attr("href");
    if (canonical) {
      const match = canonical.match(/dndbeyond\.com(\/.*)$/);
      if (match) {
        canonicalUrl = match[1];
        const segments = canonicalUrl.split("/").filter((s) => s.length > 0);
        if (segments.length > 1) {
          bookUrl = "/" + segments.slice(0, -1).join("/");
        }
      }
    }

    // Extract book title from breadcrumbs
    // D&D Beyond breadcrumbs: Home > Sources > Publisher > Book Title > Chapter
    let bookTitle: string | null = null;
    const breadcrumbs = $(".b-breadcrumb-item a, .crumb a").toArray();
    if (breadcrumbs.length >= 4) {
      // Fourth breadcrumb is the book title (after Home, Sources, Publisher)
      bookTitle = $(breadcrumbs[3]).text().trim() || null;
    }

    // Extract content
    const content = $(config.html.contentSelector);
    if (content.length === 0) {
      return {
        content: "",
        title: "",
        anchors: { valid: [], htmlIdToAnchor: {} },
        url: null,
        bookUrl: null,
        bookTitle,
        images: [],
      };
    }

    // Remove unwanted elements
    for (const selector of config.html.removeSelectors) {
      content.find(selector).remove();
    }

    // Fix nested lists
    content
      .find("ol > ul, ol > ol, ul > ul, ul > ol")
      .each((_index: number, element: AnyNode) => {
        const $nestedList = $(element);
        const $previousLi = $nestedList.prev("li");
        if ($previousLi.length > 0) {
          $nestedList.remove();
          $previousLi.append($nestedList);
        }
      });

    // Extract title: try all selectors and pick the longest result
    let title = "";

    // Try each selector and keep the longest result
    for (const selector of config.html.titleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > title.length) {
          title = text;
        }
      }
    }

    // Update first H1 in content to match extracted title
    // This ensures the file content matches the navigation title
    if (title) {
      const firstH1 = content.find("h1").first();
      if (firstH1.length > 0) {
        firstH1.text(title);
      }
    }

    // 3. Extract anchors from headings and fall back to first H1 for title
    const valid: string[] = [];
    const htmlIdToAnchor: Record<string, string> = {};
    const anchorCounts = new Map<string, number>();

    content.find("h1, h2, h3, h4, h5, h6").each((_index, element) => {
      const $heading = $(element);
      const text = $heading.text().trim();
      const htmlId = $heading.attr("id");

      // Fall back to first H1 if title still not set
      if (!title && $heading.is("h1")) {
        title = text;
      }

      const baseAnchor = generateAnchor(text);
      if (baseAnchor) {
        // Handle duplicate anchors with --N suffix to avoid conflicts with entity URL slugs
        // Example: ammunition--1 (duplicate) won't conflict with ammunition-1 (magic item)
        const count = anchorCounts.get(baseAnchor) || 0;
        const anchor = count === 0 ? baseAnchor : `${baseAnchor}--${count}`;
        anchorCounts.set(baseAnchor, count + 1);

        valid.push(anchor);
        if (htmlId) {
          htmlIdToAnchor[htmlId] = anchor;
        }
      }
    });

    // Extract images
    const images: string[] = [];
    content.find("img").each((_i, el) => {
      const src = $(el).attr("src");
      if (src) images.push(src);
    });
    content.find("figcaption a").each((_i, el) => {
      const href = $(el).attr("href");
      if (href && isImageUrl(href)) images.push(href);
    });

    return {
      content: content.html() || "",
      title,
      anchors: { valid, htmlIdToAnchor },
      url: canonicalUrl,
      bookUrl,
      bookTitle,
      images,
    };
  }

  function convertToMarkdown(htmlContent: string): string {
    if (!htmlContent) return "";
    const urlMapping = new Map(Object.entries(imageMapping));
    const turndown = createTurndownService(config.markdown, urlMapping);
    return turndown.turndown(htmlContent);
  }

  async function downloadImages(file: FileDescriptor): Promise<void> {
    if (!config.images.download) {
      return;
    }

    if (!file.images?.length) {
      return;
    }

    for (const src of file.images) {
      const extension =
        extname(new URL(src, "https://www.dndbeyond.com").pathname) || ".png";
      const format = extension.slice(1);

      if (!config.images.formats.includes(format)) continue;

      const path =
        imageMapping[src] ?? `${ctx.idGenerator.generate()}${extension}`;
      const outputPath = join(dirname(file.outputPath), path);

      if (ctx.refetch || !(await fileExists(outputPath))) {
        try {
          await downloadImage(src, outputPath);
          tracker.incrementImagesDownloaded();
        } catch (error) {
          tracker.trackError(src, error, "image");
          tracker.incrementImagesFailed();
        }
      } else {
        tracker.incrementImagesCached();
      }

      imageMapping[src] = path;
    }
  }

  function buildNavigation(file: FileDescriptor): {
    prev?: string;
    index: string;
    next?: string;
  } {
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);
    if (!sourcebook) {
      return { index: "[Index](index.md)" };
    }

    const sbFiles = files.filter((f) => f.sourcebookId === file.sourcebookId);
    const idx = sbFiles.findIndex((f) => f.id === file.id);

    const indexTitle = sourcebook.title || "Index";
    const indexLink = `[${indexTitle}](${sourcebook.id}.md)`;

    if (idx === -1) {
      return { index: indexLink };
    }

    const nav: { prev?: string; index: string; next?: string } = {
      index: indexLink,
    };

    if (idx > 0) {
      const prev = sbFiles[idx - 1];
      const prevTitle = prev.title || filenameToTitle(prev.filename);
      nav.prev = `← [${prevTitle}](${prev.id}.md)`;
    }

    if (idx < sbFiles.length - 1) {
      const next = sbFiles[idx + 1];
      const nextTitle = next.title || filenameToTitle(next.filename);
      nav.next = `[${nextTitle}](${next.id}.md) →`;
    }

    return nav;
  }

  async function writeDocument(
    file: FileDescriptor,
    markdown: string,
    sourcebook: SourcebookInfo,
  ): Promise<void> {
    const template = await loadFileTemplate(
      sourcebook.templates.file,
      globalTemplates?.file ?? null,
      config.markdown,
    );

    const context: FileTemplateContext = {
      title: file.title || "",
      date: new Date().toISOString().split("T")[0],
      tags: ["dnd5e/chapter"],
      sourcebook: {
        title: sourcebook.title,
        metadata: sourcebook.metadata,
      },
      navigation: buildNavigation(file),
      content: markdown,
    };

    const finalMarkdown = template(context);
    await mkdir(dirname(file.outputPath), { recursive: true });
    await writeFile(file.outputPath, finalMarkdown, "utf-8");
  }

  /**
   * Auto-detect and copy cover image from sourcebook directory
   * Looks for cover.{format} using configured image formats
   */
  async function copyCoverImage(
    sourcebook: SourcebookInfo,
  ): Promise<string | undefined> {
    const directoryPath = join(config.input, sourcebook.directory);

    // Find cover file
    let coverPath: string | undefined;
    let coverExt: string | undefined;

    for (const ext of config.images.formats) {
      const testPath = join(directoryPath, `cover.${ext}`);
      if (await fileExists(testPath)) {
        coverPath = testPath;
        coverExt = ext;
        break;
      }
    }

    if (!coverPath || !coverExt) return undefined;

    const mappingKey = `cover:${sourcebook.directory}/cover.${coverExt}`;
    const imageId = imageMapping[mappingKey]
      ? extractIdFromFilename(imageMapping[mappingKey])
      : ctx.idGenerator.generate();

    const localFilename = `${imageId}.${coverExt}`;
    const outputPath = join(config.output, localFilename);

    // Check if file already exists (use cache)
    if (await fileExists(outputPath)) {
      imageMapping[mappingKey] = localFilename;
      return localFilename;
    }

    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(coverPath, outputPath);
      imageMapping[mappingKey] = localFilename;
      return localFilename;
    } catch (error) {
      tracker.trackError(coverPath, error, "image");
      return undefined;
    }
  }

  async function writeIndexes(): Promise<void> {
    for (const sourcebook of sourcebooks) {
      const coverImage = await copyCoverImage(sourcebook);

      const template = await loadIndexTemplate(
        sourcebook.templates.index,
        globalTemplates?.index ?? null,
        config.markdown,
      );

      const sbFiles = files.filter((f) => f.sourcebookId === sourcebook.id);

      const context: IndexTemplateContext = {
        coverImage,
        title: sourcebook.title,
        date: new Date().toISOString().split("T")[0],
        metadata: sourcebook.metadata,
        files: sbFiles.map((file) => ({
          title: file.title || "",
          filename: `${file.id}.md`,
          id: file.id,
        })),
      };

      const indexMarkdown = template(context);
      await mkdir(dirname(sourcebook.outputPath), { recursive: true });
      await writeFile(sourcebook.outputPath, indexMarkdown, "utf-8");
    }
  }

  // ============================================================================
  // Main Orchestration
  // ============================================================================

  tracker.setTotalFiles(files.length);

  // Pass 1: Parse all HTML files and extract metadata
  for (const file of files) {
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);
    if (!sourcebook) continue;

    try {
      const { content, title, anchors, url, bookUrl, bookTitle, images } =
        await parseHtml(file);

      file.anchors = anchors;
      file.title = title;
      file.url = url ?? undefined;
      file.content = content;
      file.images = images;

      if (!sourcebook.bookUrl && bookUrl) {
        sourcebook.bookUrl = bookUrl;
      }

      // Auto-detect sourcebook title from breadcrumbs
      if (bookTitle) {
        sourcebook.title = bookTitle;
      }

      // Auto-detect source metadata from bookUrl slug
      if (bookUrl && !sourcebook.ddbSourceId) {
        const slug = extractSlugFromUrl(bookUrl);
        if (slug) {
          const source = getSourceBySlug(slug);
          if (source) {
            const { ddbSourceId, ...customMetadata } = source;
            sourcebook.ddbSourceId = ddbSourceId;
            if (Object.keys(customMetadata).length > 0) {
              sourcebook.metadata = customMetadata;
            }
          }
        }
      }
    } catch (error) {
      tracker.trackError(file.relativePath, error, "file");
      tracker.incrementFailed();
    }
  }

  // Pass 2: Download images, convert to markdown, write files
  for (const file of files) {
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);
    if (!file.content || !file.images) continue;
    if (!sourcebook) continue;

    try {
      // 1. Download images
      await downloadImages(file);

      // 2. Convert to markdown (reload HTML as Cheerio for Turndown)
      const markdown = convertToMarkdown(file.content);

      // 3. Write document
      await writeDocument(file, markdown, sourcebook);
      tracker.incrementSuccessful();
      file.written = true;

      // Clear parsed data to free memory
      delete file.content;
      delete file.images;
    } catch (error) {
      tracker.trackError(file.relativePath, error, "file");
      tracker.incrementFailed();
    }
  }

  // Generate indexes and save state
  await writeIndexes();
  await saveMapping(imageMappingPath, imageMapping);
  tracker.setIndexesCreated(sourcebooks.length);
}
