/**
 * Script to create a proper PDF test file
 */

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, '..', 'test', 'data');

function createPdfFile() {
  return new Promise((resolve, reject) => {
    const outputPath = join(testDataDir, 'sample.pdf');
    // Use compress: false and simpler settings for better compatibility
    const doc = new PDFDocument({
      compress: false,
      autoFirstPage: true,
    });
    const stream = createWriteStream(outputPath);

    doc.pipe(stream);

    // Title
    doc.fontSize(24)
       .text('Sample PDF Document', { align: 'center' });

    doc.moveDown();

    // Introduction
    doc.fontSize(12)
       .text('This is a test PDF file for the PDF converter.', { align: 'left' });

    doc.moveDown();

    // Contact Information Section
    doc.fontSize(18)
       .text('Contact Information', { underline: true });

    doc.moveDown(0.5);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('John Doe');

    doc.font('Helvetica')
       .text('Email: ')
       .font('Helvetica-Oblique')
       .text('john.doe@example.com', { continued: false });

    doc.font('Helvetica')
       .text('Phone: +41 79 123 45 67');

    doc.moveDown();

    // Personal Information Section
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('Personal Information', { underline: true });

    doc.moveDown(0.5);

    doc.fontSize(12)
       .font('Helvetica')
       .text('This document contains PII for testing purposes. ');

    doc.text('The user\'s Swiss social security number is 756.1234.5678.90.');

    doc.moveDown();

    doc.text('Address: Bahnhofstrasse 1, 8001 Zürich, Switzerland');

    doc.moveDown(2);

    // Additional Info
    doc.fontSize(10)
       .text('This PDF was generated programmatically for testing the PII Anonymizer.',
             { align: 'center', color: 'gray' });

    doc.end();

    stream.on('finish', () => {
      console.log('✓ Created sample.pdf at:', outputPath);
      resolve();
    });

    stream.on('error', (error) => {
      console.error('Error creating PDF:', error);
      reject(error);
    });
  });
}

createPdfFile().catch(error => {
  console.error('Failed to create PDF file:', error);
  process.exit(1);
});
