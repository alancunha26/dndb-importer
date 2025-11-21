# D&D Beyond HTML to Markdown Converter

Convert D&D Beyond HTML sourcebooks to clean, structured Markdown files.

## Features

- Unique 4-character ID-based file naming for conflict-free organization
- Local image downloading with caching
- Navigation links between chapters (prev/index/next)
- D&D-specific formatting (stat blocks, spell descriptions, tables)
- Cross-reference resolution between books
- Customizable Handlebars templates
- Memory-efficient streaming pipeline

## Installation

**Requirements:** Node.js 18+

```bash
# Clone the repository
git clone https://github.com/alancunha26/dndb-importer.git
cd dndb-importer

# Install dependencies
npm install

# Optional: Install CLI globally
npm run build
npm link
```

After linking, you can use `dndb-convert` directly from anywhere:

```bash
dndb-convert --input ./input --output ./output
```

## Usage

```bash
# Convert all books in input directory
npm run dndb-convert -- --input ./input --output ./output

# Convert specific book
npm run dndb-convert -- --input ./input/players-handbook --output ./output

# Verbose output (shows caching stats)
npm run dndb-convert -- --input ./input --output ./output --verbose

# Use custom config file
npm run dndb-convert -- --input ./input --output ./output --config ./my-config.json

# Show config file location
npm run dndb-convert -- config
```

### Input Structure

Place downloaded HTML files in directories by sourcebook:

```
input/
  players-handbook/
    sourcebook.json         # Optional metadata
    01-introduction.html
    02-chapter-1.html
    ...
  dungeon-masters-guide/
    01-introduction.html
    ...
```

## Configuration

The tool uses a layered configuration system with deep merging:

1. **Default config** - Built-in defaults
2. **User config** - OS-specific location (see below)
3. **Custom config** - Via `--config` flag (highest priority)

### User Config Location

| OS      | Path                                              |
| ------- | ------------------------------------------------- |
| Linux   | `~/.config/dndb-importer/config.json`             |
| macOS   | `~/Library/Preferences/dndb-importer/config.json` |
| Windows | `%APPDATA%\dndb-importer\config.json`             |

### Key Options

```json
{
  "input": "./input",
  "output": "./output",
  "markdown": {
    "headingStyle": "atx",
    "bulletMarker": "-",
    "emphasis": "_",
    "strong": "**"
  },
  "images": {
    "download": true,
    "timeout": 30000,
    "retries": 3
  },
  "links": {
    "resolveInternal": true,
    "fallbackStyle": "bold"
  }
}
```

See [`src/config/default.json`](src/config/default.json) for all options and [docs/configuration.md](docs/configuration.md) for detailed documentation.

> **Note:** Default settings are optimized for D&D 2024 rulebooks. For older sourcebooks, you may need to adjust `urlAliases` and `entityLocations` in your config.

## Templates

Customize output with Handlebars templates. Templates are loaded in this order:

1. **Sourcebook-specific**: `input/players-handbook/index.md.hbs`
2. **Global**: `input/index.md.hbs`
3. **Built-in defaults**

Two template types:

- `index.md.hbs` - Table of contents for each sourcebook
- `file.md.hbs` - Individual chapter pages

See [docs/templates.md](docs/templates.md) for available variables and examples.

## Sourcebook Metadata

Add `sourcebook.json` to customize sourcebook output:

```json
{
  "title": "Player's Handbook 2024",
  "edition": "5th Edition (2024)",
  "description": "Core rulebook for creating characters",
  "author": "Wizards of the Coast",
  "coverImage": "cover.png"
}
```

All fields are optional and accessible in templates via `metadata`.

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

# Lint and format
npm run lint
npm run format
```

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration Guide](docs/configuration.md)
- [Template Guide](docs/templates.md)
- [Link Resolver](docs/resolver.md)
- [Performance](docs/performance.md)
- [Roadmap](docs/roadmap.md)

## Contributing

See the [roadmap](docs/roadmap.md) for planned features and contribution ideas.

## License

MIT
