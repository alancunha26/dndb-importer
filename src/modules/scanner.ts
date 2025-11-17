/**
 * Scanner Module
 * Discovers HTML files, assigns unique IDs, and builds file mappings
 */

import glob from "fast-glob";
import path from "node:path";
import { IdGenerator } from "../utils/id-generator";
import type { ConversionContext, FileDescriptor, SourcebookInfo } from "../types";

/**
 * Scans input directory for HTML files and populates context
 *
 * Writes to context:
 * - files: Array of FileDescriptor with unique IDs
 * - sourcebooks: Grouped files by sourcebook
 * - mappings: Map of HTML path → unique ID
 */
export async function scan(ctx: ConversionContext): Promise<void> {
  const inputDir = path.resolve(ctx.config.input.directory);
  console.log("Scanning directory:", inputDir);

  // 1. Discover HTML files using fast-glob
  const htmlFiles = await glob(ctx.config.input.pattern, {
    cwd: inputDir,
    absolute: true,
    onlyFiles: true,
  });

  if (htmlFiles.length === 0) {
    console.warn("No HTML files found in:", inputDir);
    ctx.files = [];
    ctx.sourcebooks = [];
    ctx.mappings = new Map();
    return;
  }

  console.log(`Found ${htmlFiles.length} HTML file(s)`);

  // 2. Sort files by numeric prefix (e.g., 01-, 02-, etc.)
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

  // 3. Generate unique IDs and create FileDescriptors
  const idGenerator = new IdGenerator();
  const files: FileDescriptor[] = [];
  const mappings = new Map<string, string>();

  for (const sourcePath of sortedFiles) {
    const relativePath = path.relative(inputDir, sourcePath);
    const sourcebook = path.dirname(relativePath);
    const filename = path.basename(sourcePath, path.extname(sourcePath));
    const uniqueId = idGenerator.generate();

    const outputPath = path.join(
      ctx.config.output.directory,
      sourcebook,
      `${uniqueId}${ctx.config.output.extension}`
    );

    const descriptor: FileDescriptor = {
      sourcePath,
      relativePath,
      outputPath,
      sourcebook,
      filename,
      uniqueId,
    };

    files.push(descriptor);
    mappings.set(relativePath, uniqueId);
  }

  // 4. Group files by sourcebook
  const sourcebookMap = new Map<string, FileDescriptor[]>();

  for (const file of files) {
    if (!sourcebookMap.has(file.sourcebook)) {
      sourcebookMap.set(file.sourcebook, []);
    }
    sourcebookMap.get(file.sourcebook)!.push(file);
  }

  // 5. Create SourcebookInfo objects
  const sourcebooks: SourcebookInfo[] = [];

  for (const [sourcebookName, sourcebookFiles] of sourcebookMap) {
    const indexId = idGenerator.generate();
    const title = sourcebookName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const outputPath = path.join(
      ctx.config.output.directory,
      sourcebookName,
      `${indexId}${ctx.config.output.extension}`
    );

    sourcebooks.push({
      id: indexId,
      title,
      sourcebook: sourcebookName,
      files: sourcebookFiles,
      outputPath,
    });
  }

  // Write to context
  ctx.files = files;
  ctx.sourcebooks = sourcebooks;
  ctx.mappings = mappings;

  console.log(`Grouped into ${sourcebooks.length} sourcebook(s)`);
  for (const sb of sourcebooks) {
    console.log(`  - ${sb.title}: ${sb.files.length} file(s)`);
  }
}
