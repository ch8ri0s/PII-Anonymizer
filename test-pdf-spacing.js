/**
 * Test script to verify PDF spacing fixes
 */

import { PdfToMarkdown } from './dist/converters/PdfToMarkdown.js';
import fs from 'fs/promises';

async function testPdfSpacing() {
  console.log('Testing PDF spacing fixes...\n');

  const pdfPath = '/Users/olivier/Downloads/Softcom_Attestation_LPP.pdf';
  const converter = new PdfToMarkdown();

  try {
    const markdown = await converter.convert(pdfPath);

    // Check for specific issues
    const issues = {
      'mes sie urs': markdown.includes('mes sie urs'),
      'Conform ément': markdown.includes('Conform ément'),
      'messieurs': markdown.includes('messieurs'),
      'Conformément': markdown.includes('Conformément'),
    };

    console.log('Results:');
    console.log('--------');
    for (const [text, found] of Object.entries(issues)) {
      const status = found ? '✓ FOUND' : '✗ NOT FOUND';
      console.log(`${status}: "${text}"`);
    }

    // Write output for inspection
    const outputPath = '/Users/olivier/Downloads/test-spacing-output.md';
    await fs.writeFile(outputPath, markdown, 'utf-8');
    console.log(`\nFull output written to: ${outputPath}`);

    // Show first 20 lines
    console.log('\nFirst 20 lines of output:');
    console.log('-------------------------');
    const lines = markdown.split('\n').slice(0, 20);
    lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPdfSpacing();
