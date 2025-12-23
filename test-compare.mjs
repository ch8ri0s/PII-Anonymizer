import { FileProcessor } from './fileProcessor.js';
import fs from 'fs';
import _path from 'path';

const filePath = '/Users/olivier/Downloads/Softcom_Attestation_LPP.pdf';
const outputPath = '/tmp/test-output';

// Ensure output dir exists
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

console.log('=== Node.js/Electron PII Detection Results ===\n');

try {
  const result = await FileProcessor.processFile(filePath, outputPath);

  console.log('Detected PII Matches:');
  console.log('---------------------');

  if (result.matches && result.matches.length > 0) {
    // Group by type
    const byType = {};
    for (const match of result.matches) {
      const type = match.type || 'UNKNOWN';
      if (!byType[type]) byType[type] = [];
      byType[type].push(match.text || match.value || match.originalValue);
    }

    for (const [type, values] of Object.entries(byType)) {
      console.log(`\n${type}: (${values.length})`);
      // Unique values
      const unique = [...new Set(values)];
      unique.forEach(v => console.log(`  - ${v}`));
    }

    console.log(`\n\nTotal matches: ${result.matches.length}`);
  } else {
    console.log('No PII detected');
  }

  // Show statistics if available
  if (result.stats) {
    console.log('\nStatistics:');
    console.log(JSON.stringify(result.stats, null, 2));
  }

} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
