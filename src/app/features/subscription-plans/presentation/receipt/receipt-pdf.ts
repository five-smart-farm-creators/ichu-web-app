import { loadPdfLibraries } from '../../../../shared/presentation/export/pdf-libraries';
import type { ReceiptDocument } from './receipt-document';

const MARGIN_MM = 16;
const VALUE_X_MM = 62;
const VALUE_WIDTH_MM = 132;
const LINE_HEIGHT_MM = 5;
const FOREST_RGB: [number, number, number] = [51, 81, 62];

/** Draws a receipt or quote on one A4 page and starts its download under the document's file name. */
export async function renderReceiptPdf(receipt: ReceiptDocument): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibraries();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(receipt.brand, MARGIN_MM, 16);
  pdf.setFontSize(18);
  pdf.text(receipt.title, MARGIN_MM, 28);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(receipt.notice, MARGIN_MM, 36);

  // Long values wrap onto extra lines, so each row starts where the previous one ended.
  let y = 46;
  for (const detail of receipt.details) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(detail.label, MARGIN_MM, y);
    pdf.setFont('helvetica', 'normal');
    const lines: string[] = pdf.splitTextToSize(detail.value, VALUE_WIDTH_MM);
    pdf.text(lines, VALUE_X_MM, y);
    y += lines.length * LINE_HEIGHT_MM + 2;
  }

  autoTable(pdf, {
    startY: y + 4,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    head: [receipt.headers],
    body: receipt.rows,
    foot: [[{ content: receipt.totalLabel, colSpan: 3, styles: { halign: 'right' } }, receipt.total]],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: FOREST_RGB, textColor: 255 },
    footStyles: { fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  pdf.save(receipt.fileName);
}
