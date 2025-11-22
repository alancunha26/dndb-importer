# Performance

Notes on memory usage and processing architecture.

**Related Documentation:**

- [Architecture](architecture.md) - Two-pass processing rationale
- [Entity Indexer](indexer.md) - Entity data caching

## Two-Pass Processing

The converter uses a two-pass architecture to enable correct navigation links:

1. **Pass 1**: Parse all HTML files, extract metadata (titles, anchors, entities, URLs)
2. **Pass 2**: Download images, convert to markdown, write files with navigation

This approach allows prev/next navigation links to display the correct page titles (extracted from HTML) rather than generated from filenames.

## Memory Usage

During Pass 1, all file content is loaded into memory. This enables correct navigation but means peak memory usage scales with the number of files being converted.

### Estimated Memory by Scale

| Files | Sourcebooks | Estimated RAM |
| ----- | ----------- | ------------- |
| 75    | 5           | ~30 MB        |
| 150   | 10          | ~60 MB        |
| 300   | 20          | ~120 MB       |
| 750   | 50          | ~300 MB       |
| 1500  | 100         | ~600 MB       |

Based on typical D&D Beyond HTML files averaging ~400 KB each.

### Node.js Heap Limits

Node.js default heap size is 512 MB - 1.5 GB depending on your system. For most users converting a few sourcebooks, memory usage is not a concern.

If you need to convert a very large number of sourcebooks (50+), you can increase Node.js memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dndb-convert -- --input ./input --output ./output
```

## Processing Speed

Conversion speed depends primarily on:

1. **Disk I/O** - Reading HTML, writing markdown
2. **Network I/O** - Downloading images (first run only)
3. **HTML parsing** - Cheerio DOM operations

Subsequent runs are faster because:

- Images are cached locally (no network requests)
- File/image ID mappings are reused

## Caching

The converter maintains three cache files in the output directory:

- **`files.json`** - Maps HTML paths to markdown filenames
- **`images.json`** - Maps image URLs to local filenames
- **`indexes.json`** - Maps entity index titles to filenames and caches entity data

These enable:

- Consistent IDs across conversion runs
- Skipping already-downloaded images
- Reusing fetched entity data without re-fetching from D&D Beyond
- Faster subsequent conversions

### Cache Usage Guidelines

**Always use the same output directory** when testing to benefit from caching:

```bash
# Correct - reuses cache
npm run dndb-convert -- --input examples/input --output examples/output
npm run dndb-convert -- --input examples/input --output examples/output

# Incorrect - loses cache
npm run dndb-convert -- --input examples/input --output examples/output-test1
npm run dndb-convert -- --input examples/input --output examples/output-test2
```

Use `--verbose` flag to see caching statistics:

```bash
npm run dndb-convert -- --input examples/input --output examples/output --verbose
# Shows: "Images: 0 downloaded, 49 cached"
```

Use `--refetch` flag to force re-download of images and refetch of entity data:

```bash
npm run dndb-convert -- --input examples/input --output examples/output --refetch
```

See [Entity Indexer](indexer.md) for details on the `indexes.json` cache.
