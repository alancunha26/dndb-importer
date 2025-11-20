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
  IdGenerator,
  loadMapping,
  saveMapping,
  fileExists,
  filenameToTitle,
  isImageUrl,
  extractIdFromFilename,
  generateAnchor,
  parseEntityUrl,
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
  ParsedEntityUrl,
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
  const idGenerator = IdGenerator.fromMapping(imageMapping);

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
    entities: ParsedEntityUrl[];
    url: string | null;
    bookUrl: string | null;
    images: string[];
  }> {
    const html = await readFile(file.sourcePath, "utf-8");
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

    // Extract content
    const content = $(config.html.contentSelector);
    if (content.length === 0) {
      return {
        content: "",
        title: "",
        anchors: { valid: [], htmlIdToAnchor: {} },
        entities: [],
        url: null,
        bookUrl: null,
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

    // Extract title and anchors from headings
    let title = "";
    const valid: string[] = [];
    const htmlIdToAnchor: Record<string, string> = {};

    content.find("h1, h2, h3, h4, h5, h6").each((_index, element) => {
      const $heading = $(element);
      const text = $heading.text().trim();
      const htmlId = $heading.attr("id");

      if (!title && $heading.is("h1")) {
        title = text;
      }

      const anchor = generateAnchor(text);
      if (anchor) {
        valid.push(anchor);
        if (htmlId) {
          htmlIdToAnchor[htmlId] = anchor;
        }
      }
    });

    // Extract entity URLs from all links (deduplicated)
    const entities: ParsedEntityUrl[] = [];
    const seenUrls = new Set<string>();

    content.find("a[href]").each((_i, link) => {
      const href = $(link).attr("href");
      if (href) {
        const parsed = parseEntityUrl(href);
        if (parsed && !seenUrls.has(parsed.url)) {
          seenUrls.add(parsed.url);
          entities.push(parsed);
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
      entities,
      url: canonicalUrl,
      bookUrl,
      images,
    };
  }

  function convertToMarkdown(htmlContent: string): string {
    if (!htmlContent) return "";
    const urlMapping = new Map(Object.entries(imageMapping));
    const turndown = createTurndownService(config.markdown, urlMapping);
    return turndown.turndown(htmlContent);
  }

  async function downloadImages(
    file: FileDescriptor,
    images: string[],
  ): Promise<void> {
    if (!config.images.download || images.length === 0) return;

    for (const src of images) {
      const extension =
        extname(new URL(src, "https://www.dndbeyond.com").pathname) || ".png";
      const format = extension.slice(1);

      if (!config.images.formats.includes(format)) continue;

      const path = imageMapping[src] ?? `${idGenerator.generate()}${extension}`;
      const outputPath = join(dirname(file.outputPath), path);

      if (!(await fileExists(outputPath))) {
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
    const idx = sbFiles.findIndex((f) => f.uniqueId === file.uniqueId);

    if (idx === -1) {
      return { index: `[Index](${sourcebook.id}.md)` };
    }

    const nav: { prev?: string; index: string; next?: string } = {
      index: `[Index](${sourcebook.id}.md)`,
    };

    if (idx > 0) {
      const prev = sbFiles[idx - 1];
      nav.prev = `← [${filenameToTitle(prev.filename)}](${prev.uniqueId}.md)`;
    }

    if (idx < sbFiles.length - 1) {
      const next = sbFiles[idx + 1];
      nav.next = `[${filenameToTitle(next.filename)}](${next.uniqueId}.md) →`;
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
        edition: sourcebook.metadata.edition,
        author: sourcebook.metadata.author,
        metadata: sourcebook.metadata,
      },
      navigation: buildNavigation(file),
      content: markdown,
    };

    const finalMarkdown = template(context);
    await mkdir(dirname(file.outputPath), { recursive: true });
    await writeFile(file.outputPath, finalMarkdown, "utf-8");
  }

  async function copyCoverImage(
    sourcebook: SourcebookInfo,
  ): Promise<string | undefined> {
    const { coverImage } = sourcebook.metadata;
    if (!coverImage) return undefined;

    const inputPath = join(
      config.input,
      sourcebook.sourcebook,
      coverImage,
    );

    if (!(await fileExists(inputPath))) return undefined;

    const mappingKey = `cover:${sourcebook.sourcebook}/${coverImage}`;
    const uniqueId = imageMapping[mappingKey]
      ? extractIdFromFilename(imageMapping[mappingKey])
      : idGenerator.generate();

    const extension = extname(coverImage);
    const localFilename = `${uniqueId}${extension}`;
    const outputPath = join(config.output, localFilename);

    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(inputPath, outputPath);
      imageMapping[mappingKey] = localFilename;
      return localFilename;
    } catch (error) {
      tracker.trackError(inputPath, error, "image");
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
        title: sourcebook.title,
        date: new Date().toISOString().split("T")[0],
        edition: sourcebook.metadata.edition,
        description: sourcebook.metadata.description,
        author: sourcebook.metadata.author,
        coverImage,
        metadata: sourcebook.metadata,
        files: sbFiles.map((file) => ({
          title: file.title || "",
          filename: `${file.uniqueId}.md`,
          uniqueId: file.uniqueId,
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

  for (const file of files) {
    const sourcebook = sourcebooks.find((sb) => sb.id === file.sourcebookId);
    if (!sourcebook) continue;

    try {
      // 1. Parse HTML
      const { content, title, anchors, entities, url, bookUrl, images } =
        await parseHtml(file);

      file.anchors = anchors;
      file.title = title;
      file.url = url ?? undefined;
      file.entities = entities;

      if (!sourcebook.bookUrl && bookUrl) {
        sourcebook.bookUrl = bookUrl;
      }

      // 2. Download images
      await downloadImages(file, images);

      // 3. Convert to markdown
      const markdown = convertToMarkdown(content);

      // 4. Write document
      await writeDocument(file, markdown, sourcebook);
      file.written = true;
      tracker.incrementSuccessful();
    } catch (error) {
      tracker.trackError(file.relativePath, error, "file");
      tracker.incrementFailed();
    }
  }

  // Save state and generate indexes
  tracker.setIndexesCreated(sourcebooks.length);
  await saveMapping(imageMappingPath, imageMapping);
  await writeIndexes();
}
