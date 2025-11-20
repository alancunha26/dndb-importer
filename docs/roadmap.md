# Roadmap

Track planned features and improvements for the D&D Beyond HTML to Markdown converter.

---

## Done

| Feature                     | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| HTML to Markdown conversion | D&D-specific formatting with custom Turndown rules           |
| Unique ID system            | 4-character IDs with persistent caching for files and images |
| Image downloading           | Retry logic with exponential backoff                         |
| Link resolution             | Entity-aware matching and URL aliasing                       |
| Template system             | Handlebars templates for index and file pages                |
| Statistics & error tracking | Comprehensive stats display and issue tracking               |

---

## In Progress

_Nothing currently in progress_

---

## Planned

| Feature                    | Description                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| Auto-download HTML         | Download sourcebook HTML directly from D&D Beyond using session token |
| Unit tests                 | Tests for utility functions (anchor generation, URL parsing, etc.)    |
| Turndown rule tests        | Tests for custom D&D-specific Turndown rules                          |
| Integration tests          | Full pipeline tests with sample HTML fixtures                         |
| Progress indicators        | Progress bars for file processing and image downloads                 |
| Improved log levels        | Colored output for info, warn, error                                  |
| Concurrent image downloads | Worker pool for parallel downloads with configurable concurrency      |
| SRD examples               | Add D&D 2024 SRD content in `examples/input` and `examples/output`    |
| Expanded urlAliases        | Complete Free Rules → PHB/DMG/MM mappings                             |
| PHB entityLocations        | Full entity locations for PHB 2024                                    |
| DMG entityLocations        | Entity locations for DMG 2024 (magic items, etc.)                     |
| MM entityLocations         | Entity locations for MM 2024 (monsters)                               |

---

## Proposed

| Feature                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| Book selection         | Interactive selection of owned books to download            |
| Chapter filtering      | Download specific chapters instead of full book             |
| Token management       | Secure storage of session token in config                   |
| CI/CD pipeline         | GitHub Actions for automated testing                        |
| Code coverage          | Coverage reporting and badges                               |
| Quiet mode             | `--quiet` flag for minimal output                           |
| Debug mode             | `--debug` flag for verbose troubleshooting                  |
| JSON output            | Structured log output for tooling integration               |
| Rate limiting          | Avoid overwhelming D&D Beyond servers                       |
| Incremental conversion | Only re-process changed HTML files                          |
| Memory optimization    | Stream large files, lazy loading                            |
| Mapping contributions  | Document how users can contribute mappings                  |
| Adventure modules      | Support for adventure module structure                      |
| Legacy content         | Support for 2014 edition sourcebooks                        |
| Validate command       | `dndb-convert validate` - Check links without re-converting |
| Clean command          | `dndb-convert clean` - Remove output directory              |
| Stats command          | `dndb-convert stats` - Show statistics for existing output  |
| Dry-run mode           | `--dry-run` flag to preview conversion                      |
| Watch mode             | Auto-convert on input file changes                          |
| Link report            | Generate report of unresolved links with suggestions        |
| Plugin system          | Custom Turndown rules via config                            |
| Output formats         | Presets for Obsidian, Notion, CommonMark                    |
| Template partials      | Reusable template components                                |
| Processing hooks       | Pre/post processing customization                           |
| User guide             | Common workflows and tutorials                              |
| Troubleshooting guide  | Solutions for common issues                                 |
| Config reference       | All options explained with examples                         |

---

## Future Considerations

Ideas that need more exploration before committing.

| Feature             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| Web interface       | Simple UI for non-technical users                    |
| Content sync        | Detect source updates, merge changes                 |
| Global entity index | Cross-sourcebook entity search                       |
| Accessibility       | Screen reader friendly output, alt text improvements |

---

## Contributing

If you'd like to contribute:

1. Open an issue to discuss the approach
2. Reference this roadmap in your PR
3. Move items between sections as work progresses

## Changelog

- **2025-11-20** - Initial roadmap created for v1.0 release
