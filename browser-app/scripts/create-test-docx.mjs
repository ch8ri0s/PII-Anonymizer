/**
 * Script to create DOCX test fixtures for browser-app tests
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'test', 'fixtures');

async function createDocxFiles() {
  // Ensure fixtures directory exists
  await mkdir(fixturesDir, { recursive: true });

  // Create sample.docx with headings, paragraphs, and formatting
  const sampleDoc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Sample Document',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'This is a test document for the DOCX converter.',
            }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Contact Information',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Name: ', bold: true }),
            new TextRun({ text: 'Hans Müller' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Email: ', bold: true }),
            new TextRun({ text: 'hans.mueller@example.ch', italics: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Phone: ', bold: true }),
            new TextRun({ text: '+41 79 123 45 67' }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Address Details',
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Bahnhofstrasse 42, 8001 Zürich' }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Special characters: äöü ß éèê çñ' }),
          ],
        }),
      ],
    }],
  });

  const sampleBuffer = await Packer.toBuffer(sampleDoc);
  await writeFile(join(fixturesDir, 'sample.docx'), sampleBuffer);
  console.log('✓ Created sample.docx');

  // Create table.docx with a table
  const tableDoc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Contact List',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })] })],
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Email', bold: true })] })],
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'City', bold: true })] })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'John Doe' })] }),
                new TableCell({ children: [new Paragraph({ text: 'john@example.com' })] }),
                new TableCell({ children: [new Paragraph({ text: 'Zurich' })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Jane Smith' })] }),
                new TableCell({ children: [new Paragraph({ text: 'jane@example.com' })] }),
                new TableCell({ children: [new Paragraph({ text: 'Geneva' })] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'End of document.',
        }),
      ],
    }],
  });

  const tableBuffer = await Packer.toBuffer(tableDoc);
  await writeFile(join(fixturesDir, 'table.docx'), tableBuffer);
  console.log('✓ Created table.docx');

  // Create list.docx with bullet and numbered lists
  const listDoc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Lists Example',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Bullet List:',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: 'First bullet item',
          bullet: { level: 0 },
        }),
        new Paragraph({
          text: 'Second bullet item',
          bullet: { level: 0 },
        }),
        new Paragraph({
          text: 'Nested bullet item',
          bullet: { level: 1 },
        }),
        new Paragraph({
          text: 'Third bullet item',
          bullet: { level: 0 },
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Summary',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: 'This document demonstrates list formatting.',
        }),
      ],
    }],
  });

  const listBuffer = await Packer.toBuffer(listDoc);
  await writeFile(join(fixturesDir, 'list.docx'), listBuffer);
  console.log('✓ Created list.docx');

  console.log('\n✓ All DOCX fixtures created successfully');
}

createDocxFiles().catch(error => {
  console.error('Error creating DOCX files:', error);
  process.exit(1);
});
