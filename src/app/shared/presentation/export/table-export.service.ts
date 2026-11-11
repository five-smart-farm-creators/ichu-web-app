import { Injectable } from '@angular/core';
import type { Cell, Row } from 'write-excel-file/browser';

/** A cell value; dates are written as calendar days. */
export type ExportValue = string | number | Date | null;

/** One exported column: its translated header and how a row supplies the value. */
export interface ExportColumn<RowItem> {
  readonly header: string;
  readonly value: (row: RowItem) => ExportValue;
}

const PAGE_MARGIN_MM = 14;
const FOREST_RGB: [number, number, number] = [51, 81, 62];

/** Writes table rows to Excel or PDF in the browser; each library loads only when its format is requested. */
@Injectable({ providedIn: 'root' })
export class TableExportService {
  /** Downloads `<fileName>-<yyyy-MM-dd>.xlsx`; callers pass the area prefix, such as `ichu-cattle`. */
  async exportExcel<RowItem>(
    fileName: string,
    columns: readonly ExportColumn<RowItem>[],
    rows: readonly RowItem[],
  ): Promise<void> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const header: Row = columns.map(column => ({ value: column.header, fontWeight: 'bold' as const }));
    const body = rows.map(row => columns.map(column => excelCell(column.value(row))));
    await writeXlsxFile([header, ...body], { columns: columns.map(() => ({ width: 22 })) })
      .toFile(datedFileName(fileName, 'xlsx'));
  }

  /** Downloads an A4 landscape PDF with a title, a subtitle and page numbers. */
  async exportPdf<RowItem>(
    fileName: string,
    title: string,
    columns: readonly ExportColumn<RowItem>[],
    rows: readonly RowItem[],
    subtitle = '',
  ): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();

    document.setFontSize(16);
    document.text(title, PAGE_MARGIN_MM, 16);
    document.setFontSize(10);
    document.text(subtitle, PAGE_MARGIN_MM, 23);
    autoTable(document, {
      startY: 28,
      margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM, bottom: 16 },
      head: [columns.map(column => column.header)],
      body: rows.map(row => columns.map(column => pdfCell(column.value(row)))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: FOREST_RGB, textColor: 255 },
    });

    const pageCount = document.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      document.setPage(page);
      document.setFontSize(8);
      document.text(`${page} / ${pageCount}`, pageWidth - PAGE_MARGIN_MM, pageHeight - 8, { align: 'right' });
    }
    document.save(datedFileName(fileName, 'pdf'));
  }
}

function excelCell(value: ExportValue): Cell {
  return value instanceof Date ? { value, format: 'yyyy-mm-dd' } : value;
}

function pdfCell(value: ExportValue): string {
  if (value === null) return '';
  return value instanceof Date ? formatDay(value) : String(value);
}

function datedFileName(fileName: string, extension: string): string {
  return `${fileName}-${formatDay(new Date())}.${extension}`;
}

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
