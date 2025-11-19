/**
 * Scanner Module
 * Discovers HTML files, assigns unique IDs, and builds file mappings
 */

import glob from "fast-glob";
import path from "node:path";
import { readFile } from "fs/promises";
import { load } from "cheerio";
import { IdGenerator } from "../utils/id-generator";
import { loadMapping, saveMapping } from "../utils/mapping";
import { fileExists } from "../utils/fs";
import { filenameToTitle, extractIdFromFilename } from "../utils/string";
import { SourcebookMetadataSchema } from "../types/files";
import type {
  ConversionContext,
  FileDescriptor,
  FileMapping,
  SourcebookInfo,
  SourcebookMetadata,
  TemplateSet,
} from "../types";

/**
 * Detect template files in a directory
 * Returns paths to index.md.hbs and file.md.hbs if they exist
 */
async function detectTemplates(directory: string): Promise<TemplateSet> {
  const indexPath = path.join(directory, "index.md.hbs");
  const filePath = path.join(directory, "file.md.hbs");

  return {
    index: (await fileExists(indexPath)) ? indexPath : null,
    file: (await fileExists(filePath)) ? filePath : null,
  };
}

/**
 * Load sourcebook metadata from sourcebook.json
 * Returns empty object if file doesn't exist or parsing/validation fails
 */
async function loadSourcebookMetadata(
  directory: string,
  ctx: ConversionContext,
): Promise<SourcebookMetadata> {
  const metadataPath = path.join(directory, "sourcebook.json");

  try {
    const exists = await fileExists(metadataPath);
    if (!exists) {
      return {};
    }

    const content = await readFile(metadataPath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate with Zod schema
    const metadata = SourcebookMetadataSchema.parse(parsed);
    return metadata as SourcebookMetadata;
  } catch (error) {
    // Track error silently - don't interrupt spinner
    ctx.errors?.resources.push({ path: metadataPath, error: error as Error });
    return {};
  }
}

/**
 * Extract book-level URL from an HTML file's canonical URL
 * Returns null if canonical URL not found or extraction fails
 *
 * Example: https://www.dndbeyond.com/sources/dnd/phb-2024/welcome-to-adventure
 *          → /sources/dnd/phb-2024
 */
async function extractBookUrl(htmlFilePath: string): Promise<string | null> {
  try {
    const html = await readFile(htmlFilePath, "utf-8");
    const $ = load(html);
    const canonical = $('link[rel="canonical"]').attr("href");

    if (!canonical) {
      return null;
    }

    // Extract path from full URL: https://www.dndbeyond.com/sources/dnd/phb-2024/spells → /sources/dnd/phb-2024/spells
    const match = canonical.match(/dndbeyond\.com(\/.*)$/);
    if (!match) {
      return null;
    }

    const fullPath = match[1];
    // Remove last segment to get book-level URL: /sources/dnd/phb-2024/spells → /sources/dnd/phb-2024
    const segments = fullPath.split('/').filter(s => s.length > 0);
    if (segments.length <= 1) {
      return null;
    }

    // Return all segments except the last one
    return '/' + segments.slice(0, -1).join('/');
  } catch (error) {
    return null;
  }
}

/**
 * Scans input directory for HTML files and populates context
 *
 * Writes to context:
 * - files: All files (flat list) - primary data structure
 * - sourcebooks: Sourcebook metadata only (no files array, includes bookUrl)
 * - globalTemplates: Global templates from input root
 */
export async function scan(ctx: ConversionContext): Promise<void> {
  const inputDir = path.resolve(ctx.config.input.directory);

  // 1. Detect global templates (in input root)
  const globalTemplates = await detectTemplates(inputDir);

  // 2. Discover HTML files using fast-glob (exclude .hbs files)
  const htmlFiles = await glob(ctx.config.input.pattern, {
    cwd: inputDir,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/*.hbs"], // Skip template files
  });

  if (htmlFiles.length === 0) {
    ctx.files = [];
    ctx.sourcebooks = [];
    ctx.globalTemplates = globalTemplates;
    return;
  }

  // 3. Sort files by numeric prefix (e.g., 01-, 02-, etc.)
  const sortedFiles = htmlFiles.sort((a, b) => {
    const nameA = path.basename(a);
    const nameB = path.basename(b);

    // Extract numeric prefix if present
    const matchA = nameA.match(/^(\d+)-/);
    const matchB = nameB.match(/^(\d+)-/);

    if (matchA && matchB) {
      return parseInt(matchA[1]) - parseInt(matchB[1]);
    }

    // Fallback to alphabetical sort
    return nameA.localeCompare(nameB);
  });

  // 4. Load persistent file mapping (HTML path -> markdown filename)
  const fileMappingPath = path.join(ctx.config.output.directory, "files.json");
  const fileMapping = await loadMapping(fileMappingPath);
  const idGenerator = IdGenerator.fromMapping(fileMapping);
  const updatedFileMapping: FileMapping = { ...fileMapping };

  // 5. Single pass: Process files and create sourcebooks on-demand
  const files: FileDescriptor[] = [];
  const sourcebooks: SourcebookInfo[] = [];
  const sourcebookIdMap = new Map<string, string>(); // sourcebook dir name → ID
  const processedSourcebooks = new Set<string>(); // Track which sourcebooks we've seen

  for (const sourcePath of sortedFiles) {
    const relativePath = path.relative(inputDir, sourcePath);
    const sourcebook = path.dirname(relativePath);
    const filename = path.basename(sourcePath, path.extname(sourcePath));

    // Create SourcebookInfo on first encounter
    if (!processedSourcebooks.has(sourcebook)) {
      processedSourcebooks.add(sourcebook);

      // Detect sourcebook-specific templates and metadata
      const sourcebookDir = path.join(inputDir, sourcebook);
      const sourcebookTemplates = await detectTemplates(sourcebookDir);
      const metadata = await loadSourcebookMetadata(sourcebookDir, ctx);

      // Check if index file already has a mapping
      const indexKey = `${sourcebook}/index`;
      let indexId: string;

      if (fileMapping[indexKey]) {
        // Reuse existing index ID
        indexId = extractIdFromFilename(fileMapping[indexKey]);
      } else {
        // Generate new index ID
        indexId = idGenerator.generate();
        // Add to updated mapping
        updatedFileMapping[indexKey] =
          `${indexId}${ctx.config.output.extension}`;
      }

      // Use title from metadata, or generate from directory name
      const title = metadata.title ?? filenameToTitle(sourcebook);

      const outputPath = path.join(
        ctx.config.output.directory,
        `${indexId}${ctx.config.output.extension}`,
      );

      // Extract book-level URL from first file
      // Example: /sources/dnd/phb-2024
      const bookUrl = await extractBookUrl(sourcePath);

      sourcebooks.push({
        id: indexId,
        title,
        sourcebook,
        outputPath,
        metadata,
        templates: sourcebookTemplates,
        bookUrl: bookUrl ?? undefined,
      });

      sourcebookIdMap.set(sourcebook, indexId);
    }

    // Generate unique ID for this file
    let uniqueId: string;
    if (fileMapping[relativePath]) {
      // Reuse existing ID from mapping
      uniqueId = extractIdFromFilename(fileMapping[relativePath]);
    } else {
      // Generate new ID
      uniqueId = idGenerator.generate();
      // Add to updated mapping
      updatedFileMapping[relativePath] =
        `${uniqueId}${ctx.config.output.extension}`;
    }

    const outputPath = path.join(
      ctx.config.output.directory,
      `${uniqueId}${ctx.config.output.extension}`,
    );

    const sourcebookId = sourcebookIdMap.get(sourcebook)!;

    const descriptor: FileDescriptor = {
      sourcePath,
      relativePath,
      outputPath,
      sourcebook,
      sourcebookId,
      filename,
      uniqueId,
    };

    // Add to flat list
    files.push(descriptor);
  }

  // 7. Save updated file mapping
  await saveMapping(fileMappingPath, updatedFileMapping);

  // Write to context
  ctx.files = files;
  ctx.sourcebooks = sourcebooks;
  ctx.globalTemplates = globalTemplates;
}
