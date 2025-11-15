# D&D Beyond HTML to Markdown Converter

Convert D&D Beyond HTML sourcebooks to clean, structured Markdown files.

## Overview

This CLI tool converts locally downloaded D&D Beyond HTML pages into Markdown format with:
- Unique ID-based file naming for conflict-free organization
- Local image downloading with unique IDs
- Navigation links between related content
- D&D-specific formatting preservation (stat blocks, spell descriptions, tables)
- YAML front matter with metadata

## Project Status

🚧 **In Development** - Project structure is set up, implementation in progress.

See [docs/rfcs/0001-dndbeyond-html-markdown-converter.md](docs/rfcs/0001-dndbeyond-html-markdown-converter.md) for the complete architecture specification.

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode
npm run dndb-convert -- --help

# Build for production
npm run build

# Run built version
npm run dndb-convert:dist -- --help

# Type check
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

## Usage

```bash
# Convert all books in input directory
dndb-convert --input ./input --output ./output

# Convert specific book
dndb-convert --input ./input/players-handbook --output ./output

# Dry run (preview without writing)
dndb-convert --input ./input --dry-run

# Verbose output
dndb-convert --input ./input --output ./output --verbose

# Use custom config file
dndb-convert --input ./input --output ./output --config ./my-config.json
```

## Configuration

The tool uses a layered configuration system:

1. **Default config** - Built-in defaults from `config/default.json`
2. **User config** - OS-specific user configuration (optional)
3. **Custom config** - CLI `--config` flag (highest priority)

### User Config Location

```bash
# Show where your user config should be located
dndb-convert config
```

**Config locations by OS:**
- **Linux:** `$XDG_CONFIG_HOME/dndbeyond-importer/config.json` (defaults to `~/.config/dndbeyond-importer/config.json`)
- **macOS:** `~/Library/Preferences/dndbeyond-importer/config.json`
- **Windows:** `%APPDATA%\dndbeyond-importer\config.json`

Create a `config.json` in your OS-specific directory to customize settings. See `src/config/default.json` for all available options.

The configuration system follows the XDG Base Directory specification on Linux and platform conventions on other operating systems.

## Project Structure

```
dndbeyond-importer/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point
│   │   └── commands/
│   │       ├── convert.ts        # Main conversion command
│   │       └── config.ts         # Config command
│   ├── types.ts                  # All TypeScript type definitions
│   ├── converter.ts              # Main conversion orchestration
│   ├── scanner.ts                # File discovery and ID generation
│   ├── html-processor.ts         # HTML parsing and cleaning
│   ├── image-handler.ts          # Image downloading
│   ├── markdown-writer.ts        # File writing and navigation
│   ├── config/
│   │   └── default.json          # Default configuration
│   ├── turndown/
│   │   ├── config.ts             # Turndown configuration
│   │   └── rules/                # Custom conversion rules
│   └── utils/
│       ├── config.ts             # Configuration loader
│       ├── logger.ts             # Logging utility
│       └── id-generator.ts       # Unique ID generation
├── docs/
│   └── rfcs/                     # Architecture RFCs
├── tests/
│   └── fixtures/                 # Sample HTML for testing
└── dist/                         # Built output
```

## Technology Stack

- **Node.js** 18+
- **TypeScript** 5+
- **Turndown** - HTML to Markdown conversion
- **Cheerio** - HTML parsing
- **Commander.js** - CLI framework
- **Chalk** - Terminal styling
- **env-paths** - Cross-platform config paths (XDG on Linux)
- **esbuild** - Production builds

## License

ISC
