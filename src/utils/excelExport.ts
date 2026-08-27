import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date' | 'percent';
  alignment?: 'left' | 'center' | 'right';
}

export interface ExcelExportConfig {
  fileName: string;
  sheetName?: string;
  companyName?: string;
  reportTitle: string;
  filterSummary?: Record<string, string | number | boolean | undefined | null>;
  columns: ExcelColumn[];
  data: any[];
  summaryRow?: Record<string, any> | boolean;
  theme?: 'navy' | 'emerald' | 'purple' | 'slate';
}

export interface MultiSheetExcelConfig {
  fileName: string;
  companyName?: string;
  reportTitle?: string;
  sheets: {
    sheetName: string;
    reportTitle: string;
    filterSummary?: Record<string, string | number | boolean | undefined | null>;
    columns: ExcelColumn[];
    data: any[];
    summaryRow?: Record<string, any> | boolean;
    theme?: 'navy' | 'emerald' | 'purple' | 'slate';
  }[];
}

/**
 * Formats data into a structured XLSX Worksheet with company headers,
 * auto column widths, formatted numbers, and summary totals.
 */
const createWorksheet = (config: {
  companyName?: string;
  reportTitle: string;
  filterSummary?: Record<string, string | number | boolean | undefined | null>;
  columns: ExcelColumn[];
  data: any[];
  summaryRow?: Record<string, any> | boolean;
}): XLSX.WorkSheet => {
  const {
    companyName = 'ZOHAIB ALI & COMPANY',
    reportTitle,
    filterSummary,
    columns,
    data,
    summaryRow = true
  } = config;

  const numCols = Math.max(columns.length, 4);
  const rows: any[][] = [];
  const merges: XLSX.Range[] = [];

  // Row 0: Company Name
  rows.push([companyName]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } });

  // Row 1: Report Title
  rows.push([reportTitle.toUpperCase()]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } });

  // Row 2: Generated Timestamp
  const now = new Date();
  const timestampStr = `Generated on: ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  rows.push([timestampStr]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } });

  // Row 3: Filters Applied (if any)
  let currentRowIdx = 3;
  if (filterSummary && Object.keys(filterSummary).length > 0) {
    const activeFilters = Object.entries(filterSummary)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'All')
      .map(([k, v]) => `${k}: ${v}`)
      .join('  |  ');

    if (activeFilters) {
      rows.push([`Filters Applied: ${activeFilters}`]);
      merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: numCols - 1 } });
      currentRowIdx++;
    }
  }

  // Row (currentRowIdx): Spacer
  rows.push([]);
  currentRowIdx++;

  // Row (currentRowIdx): Table Column Headers
  const headerRowIdx = currentRowIdx;
  rows.push(columns.map(c => c.header));
  currentRowIdx++;

  // Data Rows
  const dataStartRowIdx = currentRowIdx;
  data.forEach(item => {
    const rowValues = columns.map(col => {
      const val = item[col.key];
      if (val === undefined || val === null) return '';
      if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
        const num = Number(val);
        return isNaN(num) ? val : num;
      }
      return val;
    });
    rows.push(rowValues);
    currentRowIdx++;
  });
  const dataEndRowIdx = currentRowIdx - 1;

  // Summary / Totals Row
  if (data.length > 0 && summaryRow) {
    const totals: any[] = [];
    columns.forEach((col, idx) => {
      if (idx === 0) {
        totals.push('TOTAL SUMMARY:');
      } else if (typeof summaryRow === 'object' && summaryRow[col.key] !== undefined) {
        totals.push(summaryRow[col.key]);
      } else if (col.type === 'currency' || col.type === 'number') {
        const sum = data.reduce((acc, row) => {
          const val = Number(row[col.key]);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);
        totals.push(sum);
      } else {
        totals.push('');
      }
    });
    rows.push(totals);
  }

  // Create worksheet from arrays of arrays
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set merges
  ws['!merges'] = merges;

  // Calculate auto column widths
  ws['!cols'] = columns.map(col => {
    let maxLen = col.header.length;
    data.forEach(row => {
      const cellVal = row[col.key];
      if (cellVal !== undefined && cellVal !== null) {
        const str = String(cellVal);
        if (str.length > maxLen) maxLen = str.length;
      }
    });
    if (col.type === 'currency') maxLen += 6;
    return { wch: Math.min(Math.max(col.width || 0, maxLen + 4, 12), 48) };
  });

  return ws;
};

/**
 * Universal 1-Click Excel Exporter (.xlsx)
 */
export const exportToExcel = async (config: ExcelExportConfig): Promise<void> => {
  try {
    const wb = XLSX.utils.book_new();
    const sheetName = (config.sheetName || 'Report').substring(0, 31).replace(/[\\/?*[\]]/g, '_');
    const ws = createWorksheet({
      companyName: config.companyName,
      reportTitle: config.reportTitle,
      filterSummary: config.filterSummary,
      columns: config.columns,
      data: config.data,
      summaryRow: config.summaryRow
    });

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanFileName = config.fileName.endsWith('.xlsx') ? config.fileName : `${config.fileName}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  } catch (error) {
    console.error('Failed to export Excel report:', error);
    throw error;
  }
};

/**
 * Multi-Sheet Consolidated Excel Exporter (.xlsx)
 */
export const exportMultiSheetExcel = async (config: MultiSheetExcelConfig): Promise<void> => {
  try {
    const wb = XLSX.utils.book_new();

    config.sheets.forEach(sheetConfig => {
      const sheetName = sheetConfig.sheetName.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
      const ws = createWorksheet({
        companyName: config.companyName,
        reportTitle: sheetConfig.reportTitle,
        filterSummary: sheetConfig.filterSummary,
        columns: sheetConfig.columns,
        data: sheetConfig.data,
        summaryRow: sheetConfig.summaryRow
      });

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const cleanFileName = config.fileName.endsWith('.xlsx') ? config.fileName : `${config.fileName}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  } catch (error) {
    console.error('Failed to export multi-sheet Excel report:', error);
    throw error;
  }
};
