import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

const THEME_COLORS = {
  navy: {
    headerFill: '1E3A8A', // Tailwind blue-900
    headerFont: 'FFFFFF',
    accentFill: 'EFF6FF', // Tailwind blue-50
    borderColor: 'CBD5E1',
    summaryFill: 'F1F5F9'
  },
  emerald: {
    headerFill: '065F46', // Tailwind emerald-800
    headerFont: 'FFFFFF',
    accentFill: 'ECFDF5', // Tailwind emerald-50
    borderColor: 'A7F3D0',
    summaryFill: 'F0FDF4'
  },
  purple: {
    headerFill: '581C87', // Tailwind purple-900
    headerFont: 'FFFFFF',
    accentFill: 'FAF5FF', // Tailwind purple-50
    borderColor: 'E9D5FF',
    summaryFill: 'FAF5FF'
  },
  slate: {
    headerFill: '334155', // Tailwind slate-700
    headerFont: 'FFFFFF',
    accentFill: 'F8FAFC', // Tailwind slate-50
    borderColor: 'E2E8F0',
    summaryFill: 'F1F5F9'
  }
};

/**
 * Builds and formats a single worksheet with enterprise styling, metadata header banner,
 * autofitted columns, formatted numbers, and summary totals row.
 */
const buildFormattedWorksheet = (
  worksheet: ExcelJS.Worksheet,
  config: {
    companyName?: string;
    reportTitle: string;
    filterSummary?: Record<string, string | number | boolean | undefined | null>;
    columns: ExcelColumn[];
    data: any[];
    summaryRow?: Record<string, any> | boolean;
    theme?: 'navy' | 'emerald' | 'purple' | 'slate';
  }
) => {
  const {
    companyName = 'ZOHAIB ALI & COMPANY',
    reportTitle,
    filterSummary,
    columns,
    data,
    summaryRow = true,
    theme = 'navy'
  } = config;

  const colors = THEME_COLORS[theme] || THEME_COLORS.navy;
  const numColumns = Math.max(columns.length, 4);

  // 1. Company Banner (Row 1)
  const row1 = worksheet.addRow([companyName]);
  worksheet.mergeCells(1, 1, 1, numColumns);
  row1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: colors.headerFill } };
  row1.alignment = { horizontal: 'center', vertical: 'middle' };
  row1.height = 28;

  // 2. Report Title (Row 2)
  const row2 = worksheet.addRow([reportTitle.toUpperCase()]);
  worksheet.mergeCells(2, 1, 2, numColumns);
  row2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '334155' } };
  row2.alignment = { horizontal: 'center', vertical: 'middle' };
  row2.height = 20;

  // 3. Metadata & Generation Timestamp (Row 3)
  const timestampStr = `Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const row3 = worksheet.addRow([timestampStr]);
  worksheet.mergeCells(3, 1, 3, numColumns);
  row3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '64748B' } };
  row3.alignment = { horizontal: 'center', vertical: 'middle' };
  row3.height = 16;

  // 4. Applied Filters Block (if any)
  let currentRowIndex = 4;
  if (filterSummary && Object.keys(filterSummary).length > 0) {
    const activeFilters = Object.entries(filterSummary)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'All')
      .map(([k, v]) => `${k}: ${v}`)
      .join('  |  ');

    if (activeFilters) {
      const filterRow = worksheet.addRow([`Filters Applied: ${activeFilters}`]);
      worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, numColumns);
      filterRow.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '475569' } };
      filterRow.alignment = { horizontal: 'left', vertical: 'middle' };
      filterRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colors.accentFill }
      };
      filterRow.height = 18;
      currentRowIndex++;
    }
  }

  // Blank spacer row before table
  worksheet.addRow([]);
  currentRowIndex++;

  const headerRowIndex = currentRowIndex;

  // 5. Add Table Headers
  const headerValues = columns.map(c => c.header);
  const tableHeaderRow = worksheet.addRow(headerValues);
  tableHeaderRow.height = 24;

  tableHeaderRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.headerFont } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.headerFill }
    };
    cell.alignment = {
      horizontal: columns[colIndex - 1]?.alignment || (columns[colIndex - 1]?.type === 'currency' || columns[colIndex - 1]?.type === 'number' ? 'right' : columns[colIndex - 1]?.type === 'date' ? 'center' : 'left'),
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'medium', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } }
    };
  });

  const dataStartRow = headerRowIndex + 1;

  // 6. Populate Data Rows
  data.forEach((item, rIdx) => {
    const rowValues = columns.map(col => {
      const val = item[col.key];
      if (val === undefined || val === null) return '';
      if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
        const num = Number(val);
        return isNaN(num) ? val : num;
      }
      return val;
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 20;

    const isEven = rIdx % 2 === 1;

    dataRow.eachCell((cell, colIndex) => {
      const colDef = columns[colIndex - 1];
      const colType = colDef?.type || 'text';

      cell.font = { name: 'Calibri', size: 10, color: { argb: '1E293B' } };

      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8FAFC' }
        };
      }

      // Formatting
      if (colType === 'currency') {
        cell.numFmt = '"Rs. "#,##0.00;[Red]"-Rs. "#,##0.00;"Rs. 0.00"';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colType === 'number') {
        cell.numFmt = '#,##0.##';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colType === 'percent') {
        cell.numFmt = '0.00%';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colType === 'date') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = {
          horizontal: colDef?.alignment || 'left',
          vertical: 'middle'
        };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: colors.borderColor } },
        left: { style: 'thin', color: { argb: colors.borderColor } },
        bottom: { style: 'thin', color: { argb: colors.borderColor } },
        right: { style: 'thin', color: { argb: colors.borderColor } }
      };
    });
  });

  const dataEndRow = dataStartRow + data.length - 1;

  // 7. Add Summary / Totals Row
  if (data.length > 0 && summaryRow) {
    const summaryValues: any[] = [];

    columns.forEach((col, idx) => {
      if (idx === 0) {
        summaryValues.push('TOTAL:');
      } else if (typeof summaryRow === 'object' && summaryRow[col.key] !== undefined) {
        summaryValues.push(summaryRow[col.key]);
      } else if (col.type === 'currency' || col.type === 'number') {
        const colLetter = worksheet.getColumn(idx + 1).letter;
        summaryValues.push({ formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` });
      } else {
        summaryValues.push('');
      }
    });

    const totRow = worksheet.addRow(summaryValues);
    totRow.height = 22;

    totRow.eachCell((cell, colIndex) => {
      const colDef = columns[colIndex - 1];
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colors.summaryFill }
      };

      if (colDef?.type === 'currency') {
        cell.numFmt = '"Rs. "#,##0.00;[Red]"-Rs. "#,##0.00;"Rs. 0.00"';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colDef?.type === 'number') {
        cell.numFmt = '#,##0.##';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = {
          horizontal: colIndex === 1 ? 'left' : 'center',
          vertical: 'middle'
        };
      }

      cell.border = {
        top: { style: 'medium', color: { argb: '000000' } },
        bottom: { style: 'double', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: colors.borderColor } },
        right: { style: 'thin', color: { argb: colors.borderColor } }
      };
    });
  }

  // 8. Auto-fit column widths
  columns.forEach((col, idx) => {
    let maxLen = col.header.length;
    data.forEach(row => {
      const cellVal = row[col.key];
      if (cellVal !== undefined && cellVal !== null) {
        const str = String(cellVal);
        if (str.length > maxLen) maxLen = str.length;
      }
    });

    // Add extra padding for currency symbols and formatting
    if (col.type === 'currency') maxLen += 6;
    worksheet.getColumn(idx + 1).width = Math.min(Math.max(col.width || 0, maxLen + 4, 12), 45);
  });
};

/**
 * Universal One-Click Single Sheet Excel Exporter
 */
export const exportToExcel = async (config: ExcelExportConfig): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = config.companyName || 'Zohaib Ali & Company ERP';
    workbook.lastModifiedBy = 'ERP User';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet(config.sheetName || 'Report', {
      views: [{ showGridLines: true }]
    });

    buildFormattedWorksheet(sheet, config);

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanFileName = config.fileName.endsWith('.xlsx') ? config.fileName : `${config.fileName}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, cleanFileName);
  } catch (error) {
    console.error('Failed to export Excel report:', error);
    throw error;
  }
};

/**
 * Universal Multi-Sheet Consolidated Excel Exporter
 */
export const exportMultiSheetExcel = async (config: MultiSheetExcelConfig): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = config.companyName || 'Zohaib Ali & Company ERP';
    workbook.created = new Date();

    config.sheets.forEach(sheetConfig => {
      const sheet = workbook.addWorksheet(sheetConfig.sheetName, {
        views: [{ showGridLines: true }]
      });

      buildFormattedWorksheet(sheet, {
        companyName: config.companyName,
        reportTitle: sheetConfig.reportTitle,
        filterSummary: sheetConfig.filterSummary,
        columns: sheetConfig.columns,
        data: sheetConfig.data,
        summaryRow: sheetConfig.summaryRow,
        theme: sheetConfig.theme
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanFileName = config.fileName.endsWith('.xlsx') ? config.fileName : `${config.fileName}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, cleanFileName);
  } catch (error) {
    console.error('Failed to export multi-sheet Excel report:', error);
    throw error;
  }
};
