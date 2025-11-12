/**
 * Script to create a proper DOCX test file
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, '..', 'test', 'data');

async function createDocxFile() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Sample Document",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "This is a test document for the DOCX converter.",
            }),
          ],
        }),
        new Paragraph({
          text: "",
        }),
        new Paragraph({
          text: "Contact Information:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "John Doe",
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Email: ",
            }),
            new TextRun({
              text: "john.doe@example.com",
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Phone: +41 79 123 45 67",
            }),
          ],
        }),
        new Paragraph({
          text: "",
        }),
        new Paragraph({
          text: "Personal Information:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "This document contains PII for testing purposes. ",
            }),
            new TextRun({
              text: "The user's Swiss social security number is 756.1234.5678.90.",
            }),
          ],
        }),
        new Paragraph({
          text: "",
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Address: Bahnhofstrasse 1, 8001 Zürich, Switzerland",
            }),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = join(testDataDir, 'sample.docx');

  await writeFile(outputPath, buffer);
  console.log('✓ Created sample.docx at:', outputPath);
}

createDocxFile().catch(error => {
  console.error('Error creating DOCX file:', error);
  process.exit(1);
});
