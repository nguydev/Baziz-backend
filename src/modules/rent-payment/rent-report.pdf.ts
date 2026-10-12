/**
 * PDF export for landlord monthly rent report
 */

import PDFDocument from 'pdfkit';
import type { MonthlyReportResult } from './rent-payment.types';
import { formatCurrency } from './rent-payment.utils';

export const generateMonthlyReportPdf = (report: MonthlyReportResult): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Monthly Rent Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#555').text(report.label, { align: 'center' });
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(11);
    doc.text(`Total payments: ${report.summary.total}`);
    doc.text(`Paid: ${report.summary.paid}  |  Pending: ${report.summary.pending}  |  Overdue: ${report.summary.overdue}`);
    doc.moveDown(1);

    const tableTop = doc.y;
    const colX = [50, 180, 320, 400, 480];

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Tenant', colX[0], tableTop);
    doc.text('Property', colX[1], tableTop);
    doc.text('Amount', colX[2], tableTop);
    doc.text('Status', colX[3], tableTop);
    doc.text('Due', colX[4], tableTop);

    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke('#ccc');

    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(9);

    for (const row of report.payments) {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc.text(row.tenantName.slice(0, 22), colX[0], y, { width: 120 });
      doc.text(row.propertyName.slice(0, 20), colX[1], y, { width: 130 });
      doc.text(formatCurrency(row.amount, row.currency), colX[2], y);
      doc.text(row.status, colX[3], y);
      doc.text(new Date(row.dueDate).toISOString().slice(0, 10), colX[4], y);
      y += 18;
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text(
      `Generated ${new Date().toISOString()} — B-Aziz Rent Payments`,
      50,
      doc.page.height - 40,
      { align: 'center', width: doc.page.width - 100 }
    );

    doc.end();
  });
};
