/**
 * Scanner Module
 * Discovers HTML files, assigns unique IDs, and builds file mappings
 */

import glob from "fast-glob";
import path from "node:path";
import { readFile } from "fs/promises";
import { IdGenerator } from "../utils/id-generator";
import { loadMapping, saveMapping } from "../utils/mapping";
import { fileExists } from "../utils/fs";
import { filenameToTitle, extractIdFromFilename } from "../utils/string";
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
 * Returns empty object if file doesn't exist or parsing fails
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
    const metadata = JSON.parse(content) as SourcebookMetadata;
    return metadata;
  } catch (error) {
    // Track error silently - don't interrupt spinner
    ctx.errors?.resources.push({ path: metadataPath, error: error as Error });
    return {};
  }
}

/**
 * Scans input directory for HTML files and populates context
 *
 * Writes to context:
 * - files: All files (flat list) - primary data structure
 * - sourcebooks: Sourcebook metadata only (no files array)
 * - fileIndex: Map of uniqueId → FileDescriptor (for fast lookups)
 * - pathIndex: Map of relativePath → uniqueId (for URL mapping)
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
    ctx.fileIndex = new Map();
    ctx.pathIndex = new Map();
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
  const fileMapping = await loadMapping(
    ctx.config.output.directory,
    "files.json",
  );
  const idGenerator = IdGenerator.fromMapping(fileMapping);
  const updatedFileMapping: FileMapping = { ...fileMapping };

  // 5. Single pass: Process files and create sourcebooks on-demand
  const files: FileDescriptor[] = [];
  const fileIndex = new Map<string, FileDescriptor>();
  const pathIndex = new Map<string, string>();
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

      sourcebooks.push({
        id: indexId,
        title,
        sourcebook,
        outputPath,
        metadata,
        templates: sourcebookTemplates,
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

    // Add to flat list and indices
    files.push(descriptor);
    fileIndex.set(uniqueId, descriptor);
    pathIndex.set(relativePath, uniqueId);
  }

  // 7. Save updated file mapping
  await saveMapping(
    ctx.config.output.directory,
    "files.json",
    updatedFileMapping,
  );

  // Write to context
  ctx.files = files;
  ctx.sourcebooks = sourcebooks;
  ctx.fileIndex = fileIndex;
  ctx.pathIndex = pathIndex;
  ctx.globalTemplates = globalTemplates;
}
