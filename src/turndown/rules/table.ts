/**
 * Turndown Rule: Custom Table Handling
 *
 * D&D Beyond uses complex table patterns with rowspan, colspan, multiple headers,
 * and tfoot elements that don't translate cleanly to standard markdown tables.
 *
 * This rule handles:
 * - Caption extraction (rendered above table in bold)
 * - Multiple header rows (keeps detailed row, discards grouping rows)
 * - Rowspan (renders value in first row, empty cells for spanned rows)
 * - Colspan (fills with empty cells)
 * - Multiple tbody elements (combines into single table)
 * - Footer notes (extracts and renders below table)
 */

import type TurndownService from "turndown";
import type { TurndownNode, MarkdownConfig } from "../../types";

// ============================================================================
// Type Definitions
// ============================================================================

interface CellSpan {
  remaining: number; // How many more rows this cell spans
  content: string;   // The cell content (empty string for empty cells)
}

// ============================================================================
// Caption Extraction
// ============================================================================

/**
 * Extract caption text from table
 * Handles nested headings and formatting
 */
function extractCaption(table: TurndownNode): string | null {
  if (!table.childNodes) return null;

  for (const child of table.childNodes) {
    if (child.nodeName === "CAPTION") {
      const text = child.textContent?.trim();
      return text || null;
    }
  }

  return null;
}

// ============================================================================
// Footer Extraction
// ============================================================================

/**
 * Extract footer text from table
 * Returns text content from all tfoot rows
 */
function extractFooter(table: TurndownNode): string | null {
  if (!table.childNodes) return null;

  for (const child of table.childNodes) {
    if (child.nodeName === "TFOOT") {
      const text = child.textContent?.trim();
      return text || null;
    }
  }

  return null;
}

// ============================================================================
// Header Processing
// ============================================================================

/**
 * Get thead element from table
 */
function getTheadElement(table: TurndownNode): TurndownNode | null {
  if (!table.childNodes) return null;

  for (const child of table.childNodes) {
    if (child.nodeName === "THEAD") {
      return child;
    }
  }

  return null;
}

/**
 * Extract header rows from thead
 * Returns only the last (most detailed) row, discarding grouping headers
 */
function extractHeaderRow(thead: TurndownNode): TurndownNode | null {
  if (!thead.childNodes) return null;

  let lastRow: TurndownNode | null = null;

  for (const child of thead.childNodes) {
    if (child.nodeName === "TR") {
      lastRow = child;
    }
  }

  return lastRow;
}

/**
 * Extract cell text content
 */
function getCellContent(cell: TurndownNode): string {
  return (cell.textContent || "").trim();
}

/**
 * Get colspan value for a cell
 */
function getColspan(cell: TurndownNode): number {
  if (!cell.getAttribute) return 1;
  const colspan = cell.getAttribute("colspan");
  return colspan ? parseInt(colspan, 10) : 1;
}

/**
 * Get rowspan value for a cell
 */
function getRowspan(cell: TurndownNode): number {
  if (!cell.getAttribute) return 1;
  const rowspan = cell.getAttribute("rowspan");
  return rowspan ? parseInt(rowspan, 10) : 1;
}

// ============================================================================
// Body Processing
// ============================================================================

/**
 * Get all tbody elements from table
 */
function getTbodyElements(table: TurndownNode): TurndownNode[] {
  if (!table.childNodes) return [];

  const tbodies: TurndownNode[] = [];

  for (const child of table.childNodes) {
    if (child.nodeName === "TBODY") {
      tbodies.push(child);
    }
  }

  return tbodies;
}

/**
 * Extract all TR elements from tbody elements
 */
function extractBodyRows(tbodies: TurndownNode[]): TurndownNode[] {
  const rows: TurndownNode[] = [];

  for (const tbody of tbodies) {
    if (!tbody.childNodes) continue;

    for (const child of tbody.childNodes) {
      if (child.nodeName === "TR") {
        rows.push(child);
      }
    }
  }

  return rows;
}

// ============================================================================
// Row Processing with Rowspan/Colspan Tracking
// ============================================================================

/**
 * Process a single row with rowspan/colspan tracking
 * Returns array of cell contents for this row, or null if row should be merged with next
 */
function processRow(
  row: TurndownNode,
  rowspanTracker: CellSpan[],
  columnCount: number
): string[] | null {
  const cells: string[] = [];
  let colIndex = 0;

  // Get all TD/TH elements in this row
  const cellElements: TurndownNode[] = [];
  if (row.childNodes) {
    for (const child of row.childNodes) {
      if (child.nodeName === "TD" || child.nodeName === "TH") {
        cellElements.push(child);
      }
    }
  }

  let cellElementIndex = 0;
  let hasNewRowspanCells = false;
  const newRowspanCells: Array<{colIndex: number, content: string, remaining: number}> = [];

  // Process each column
  while (colIndex < columnCount) {
    // Check if this column has an active rowspan
    if (rowspanTracker[colIndex] && rowspanTracker[colIndex].remaining > 0) {
      // Use content from rowspan
      cells.push(rowspanTracker[colIndex].content);
      rowspanTracker[colIndex].remaining--;

      // After first use, clear content (subsequent rows should be empty)
      if (rowspanTracker[colIndex].content !== "") {
        rowspanTracker[colIndex].content = "";
      }

      colIndex++;
      continue;
    }

    // Get next cell element
    if (cellElementIndex < cellElements.length) {
      const cellElement = cellElements[cellElementIndex];
      cellElementIndex++;

      const content = getCellContent(cellElement);
      const colspan = getColspan(cellElement);
      const rowspan = getRowspan(cellElement);

      // Add cell content
      cells.push(content);
      const currentColIndex = colIndex;
      colIndex++;

      // Handle rowspan (track for future rows)
      if (rowspan > 1) {
        hasNewRowspanCells = true;
        newRowspanCells.push({
          colIndex: currentColIndex,
          content: content,
          remaining: rowspan - 1
        });
      }

      // Handle colspan (add empty cells)
      for (let i = 1; i < colspan; i++) {
        cells.push("");
        colIndex++;
      }
    } else {
      // No more cell elements, fill with empty
      cells.push("");
      colIndex++;
    }
  }

  // Check if this row ONLY has new rowspan cells (D&D Beyond pattern)
  // If so, mark for merging with next row
  if (hasNewRowspanCells && cellElements.length === newRowspanCells.length) {
    // All cells in this row have rowspan - save content for NEXT row only, then empty
    for (const cell of newRowspanCells) {
      rowspanTracker[cell.colIndex] = {
        remaining: cell.remaining,
        content: cell.content, // Content for next row
      };
    }
    return null; // Signal to merge with next row
  }

  // Normal row - apply rowspan tracking
  if (hasNewRowspanCells) {
    for (const cell of newRowspanCells) {
      rowspanTracker[cell.colIndex] = {
        remaining: cell.remaining,
        content: "" // Empty for subsequent rows
      };
    }
  }

  return cells;
}

/**
 * Determine column count from header row or first body row
 */
function determineColumnCount(headerRow: TurndownNode | null, bodyRows: TurndownNode[]): number {
  // Try header row first
  if (headerRow && headerRow.childNodes) {
    let count = 0;
    for (const child of headerRow.childNodes) {
      if (child.nodeName === "TH" || child.nodeName === "TD") {
        const colspan = getColspan(child);
        count += colspan;
      }
    }
    if (count > 0) return count;
  }

  // Try first body row
  if (bodyRows.length > 0 && bodyRows[0].childNodes) {
    let count = 0;
    for (const child of bodyRows[0].childNodes) {
      if (child.nodeName === "TD" || child.nodeName === "TH") {
        const colspan = getColspan(child);
        count += colspan;
      }
    }
    if (count > 0) return count;
  }

  return 0;
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Build markdown table from processed rows
 */
function buildMarkdownTable(headerCells: string[], bodyCells: string[][], _config: MarkdownConfig): string {
  const lines: string[] = [];

  // Header row
  const headerRow = "| " + headerCells.join(" | ") + " |";
  lines.push(headerRow);

  // Separator row
  const separator = "| " + headerCells.map(() => "---").join(" | ") + " |";
  lines.push(separator);

  // Body rows
  for (const row of bodyCells) {
    const bodyRow = "| " + row.join(" | ") + " |";
    lines.push(bodyRow);
  }

  return lines.join("\n");
}

// ============================================================================
// Main Table Rule
// ============================================================================

export function tableRule(config: MarkdownConfig) {
  return (service: TurndownService): void => {
    service.addRule("customTable", {
      filter: "table",
      replacement: (_content, node) => {
        const table = node as TurndownNode;

        // Extract caption
        const caption = extractCaption(table);

        // Extract footer
        const footer = extractFooter(table);

        // Extract header
        const thead = getTheadElement(table);
        const headerRow = thead ? extractHeaderRow(thead) : null;

        // Extract body rows from all tbody elements
        const tbodies = getTbodyElements(table);
        const bodyRows = extractBodyRows(tbodies);

        // Determine column count
        const columnCount = determineColumnCount(headerRow, bodyRows);
        if (columnCount === 0) {
          // Empty table
          return "\n\n";
        }

        // Initialize rowspan tracker
        const rowspanTracker: CellSpan[] = new Array(columnCount).fill(null).map(() => ({
          remaining: 0,
          content: ""
        }));

        // Process header
        let headerCells: string[] = [];
        if (headerRow) {
          const cells = processRow(headerRow, rowspanTracker, columnCount);
          headerCells = cells || new Array(columnCount).fill("");
        } else {
          // No header, create empty header
          headerCells = new Array(columnCount).fill("");
        }

        // Process body rows
        const bodyCells: string[][] = [];
        for (const row of bodyRows) {
          const cells = processRow(row, rowspanTracker, columnCount);
          if (cells !== null) {
            // Only add rows that aren't merged with next
            bodyCells.push(cells);
          }
        }

        // Build markdown
        let result = "\n\n";

        // Add caption (bold, above table)
        if (caption) {
          result += `${config.strong}${caption}${config.strong}\n\n`;
        }

        // Add table
        result += buildMarkdownTable(headerCells, bodyCells, config);

        // Add footer (plain text, below table)
        if (footer) {
          result += "\n\n" + footer;
        }

        result += "\n\n";

        return result;
      }
    });
  };
}
