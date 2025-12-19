/**
 * Test script to see raw PDF text extraction
 */

import pdfParse from 'pdf-parse';
import fs from 'fs/promises';

async function testRawPdf() {
  console.log('Extracting raw PDF text...\n');

  const pdfPath = '/Users/olivier/Downloads/Softcom_Attestation_LPP.pdf';
  const dataBuffer = await fs.readFile(pdfPath);

  try {
    const data = await pdfParse(dataBuffer);

    // Get first 500 characters
    const sample = data.text.substring(0, 500);

    console.log('Raw PDF text (first 500 chars):');
    console.log('================================');
    console.log(sample);
    console.log('================================\n');

    // Show with visible spaces
    console.log('With visible spaces (· = space):');
    console.log('==================================');
    console.log(sample.replace(/ /g, '·'));
    console.log('==================================\n');

    // Show character codes for first 200 chars
    console.log('Character codes (first 200):');
    console.log('============================');
    for (let i = 0; i < Math.min(200, sample.length); i++) {
      const char = sample[i];
      const _code = char.charCodeAt(0);
      if (char === ' ') {
        process.stdout.write('[SP]');
      } else if (char === '\n') {
        process.stdout.write('[NL]\n');
      } else {
        process.stdout.write(char);
      }
    }
    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRawPdf();
