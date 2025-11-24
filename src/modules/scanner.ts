/**
 * Scanner Module
 * Discovers HTML files, assigns unique IDs, and builds file mappings
 */

import glob from "fast-glob";
import path from "node:path";
import {
  loadMapping,
  saveMapping,
  fileExists,
  filenameToTitle,
  extractIdFromFilename,
} from "../utils";
import {
  type ConversionContext,
  type FileDescriptor,
  type FileMapping,
  type SourcebookInfo,
  type TemplateSet,
} from "../types";

/**
 * Detect template files in a directory
 * Returns paths to template files if they exist
 */
async function detectTemplates(directory: string): Promise<TemplateSet> {
  const indexPath = path.join(directory, "index.md.hbs");
  const filePath = path.join(directory, "file.md.hbs");
  const entityIndexPath = path.join(directory, "entity-index.md.hbs");
  const globalIndexPath = path.join(directory, "global-index.md.hbs");

  return {
    index: (await fileExists(indexPath)) ? indexPath : null,
    file: (await fileExists(filePath)) ? filePath : null,
    entityIndex: (await fileExists(entityIndexPath)) ? entityIndexPath : null,
    globalIndex: (await fileExists(globalIndexPath)) ? globalIndexPath : null,
  };
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
  const inputDir = path.resolve(ctx.config.input);

  // 1. Detect global templates (in input root)
  const globalTemplates = await detectTemplates(inputDir);

  // 2. Discover HTML files using fast-glob (exclude .hbs files)
  const htmlFiles = await glob("**/*.html", {
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
  const fileMappingPath = path.join(ctx.config.output, "files.json");
  const fileMapping = await loadMapping(fileMappingPath);

  // Register existing IDs with the context's generator
  for (const filename of Object.values(fileMapping)) {
    const id = filename.replace(".md", "");
    ctx.idGenerator.register(id);
  }

  const updatedFileMapping: FileMapping = { ...fileMapping };

  // 5. Single pass: Process files and create sourcebooks on-demand
  const files: FileDescriptor[] = [];
  const sourcebooks: SourcebookInfo[] = [];
  const sourcebookIdMap = new Map<string, string>(); // directory name → ID
  const processedSourcebooks = new Set<string>(); // Track which sourcebooks we've seen

  for (const inputPath of sortedFiles) {
    const relativePath = path.relative(inputDir, inputPath);
    const directory = path.dirname(relativePath);
    const filename = path.basename(inputPath, path.extname(inputPath));

    // Create SourcebookInfo on first encounter
    if (!processedSourcebooks.has(directory)) {
      processedSourcebooks.add(directory);

      // Detect sourcebook-specific templates
      const directoryPath = path.join(inputDir, directory);
      const templates = await detectTemplates(directoryPath);

      // Check if index file already has a mapping
      const indexKey = `${directory}/index`;
      let indexId: string;

      if (fileMapping[indexKey]) {
        // Reuse existing index ID
        indexId = extractIdFromFilename(fileMapping[indexKey]);
      } else {
        // Generate new index ID
        indexId = ctx.idGenerator.generate();
        // Add to updated mapping
        updatedFileMapping[indexKey] = `${indexId}.md`;
      }

      // Use directory name as initial title (will be auto-detected from HTML later)
      const title = filenameToTitle(directory);

      const outputPath = path.join(
        ctx.config.output,
        `${indexId}.md`,
      );

      // bookUrl and ddbSourceId will be auto-detected from HTML in processor
      sourcebooks.push({
        id: indexId,
        title,
        directory,
        outputPath,
        templates,
        bookUrl: undefined,
      });

      sourcebookIdMap.set(directory, indexId);
    }

    // Generate unique ID for this file
    let id: string;
    if (fileMapping[relativePath]) {
      // Reuse existing ID from mapping
      id = extractIdFromFilename(fileMapping[relativePath]);
    } else {
      // Generate new ID
      id = ctx.idGenerator.generate();
      // Add to updated mapping
      updatedFileMapping[relativePath] = `${id}.md`;
    }

    const outputPath = path.join(
      ctx.config.output,
      `${id}.md`,
    );

    const sourcebookId = sourcebookIdMap.get(directory)!;

    const descriptor: FileDescriptor = {
      inputPath,
      relativePath,
      outputPath,
      directory,
      sourcebookId,
      filename,
      id,
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
