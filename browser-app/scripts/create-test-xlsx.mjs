/**
 * Script to create Excel test fixtures for browser-app tests
 */

import ExcelJS from 'exceljs';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'test', 'fixtures');

async function createExcelFiles() {
  // Ensure fixtures directory exists
  await mkdir(fixturesDir, { recursive: true });

  // Create sample.xlsx with basic data
  const sampleWorkbook = new ExcelJS.Workbook();
  const sheet1 = sampleWorkbook.addWorksheet('Contacts');

  sheet1.columns = [
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'City', key: 'city', width: 15 },
  ];

  sheet1.addRows([
    { name: 'Hans Müller', email: 'hans@example.ch', phone: '+41 79 123 45 67', city: 'Zürich' },
    { name: 'Marie Dupont', email: 'marie@example.fr', phone: '+33 6 12 34 56 78', city: 'Paris' },
    { name: 'John Smith', email: 'john@example.com', phone: '+1 555 123 4567', city: 'New York' },
  ]);

  await sampleWorkbook.xlsx.writeFile(join(fixturesDir, 'sample.xlsx'));
  console.log('✓ Created sample.xlsx');

  // Create multi-sheet.xlsx with multiple worksheets
  const multiWorkbook = new ExcelJS.Workbook();

  const dataSheet = multiWorkbook.addWorksheet('Data');
  dataSheet.columns = [
    { header: 'Product', key: 'product', width: 20 },
    { header: 'Price', key: 'price', width: 10 },
    { header: 'Quantity', key: 'qty', width: 10 },
  ];
  dataSheet.addRows([
    { product: 'Widget A', price: 19.99, qty: 100 },
    { product: 'Widget B', price: 29.99, qty: 50 },
    { product: 'Widget C', price: 9.99, qty: 200 },
  ]);

  const summarySheet = multiWorkbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 20 },
    { header: 'Value', key: 'value', width: 15 },
  ];
  summarySheet.addRows([
    { metric: 'Total Products', value: 3 },
    { metric: 'Total Items', value: 350 },
    { metric: 'Average Price', value: '$19.99' },
  ]);

  await multiWorkbook.xlsx.writeFile(join(fixturesDir, 'multi-sheet.xlsx'));
  console.log('✓ Created multi-sheet.xlsx');

  // Create formulas.xlsx with formulas
  const formulaWorkbook = new ExcelJS.Workbook();
  const calcSheet = formulaWorkbook.addWorksheet('Calculations');

  calcSheet.getCell('A1').value = 'Value A';
  calcSheet.getCell('B1').value = 'Value B';
  calcSheet.getCell('C1').value = 'Sum';
  calcSheet.getCell('A2').value = 10;
  calcSheet.getCell('B2').value = 20;
  calcSheet.getCell('C2').value = { formula: 'A2+B2', result: 30 };
  calcSheet.getCell('A3').value = 15;
  calcSheet.getCell('B3').value = 25;
  calcSheet.getCell('C3').value = { formula: 'A3+B3', result: 40 };

  await formulaWorkbook.xlsx.writeFile(join(fixturesDir, 'formulas.xlsx'));
  console.log('✓ Created formulas.xlsx');

  // Create special-chars.xlsx with special characters
  const specialWorkbook = new ExcelJS.Workbook();
  const specialSheet = specialWorkbook.addWorksheet('Special');

  specialSheet.columns = [
    { header: 'Language', key: 'lang', width: 15 },
    { header: 'Text', key: 'text', width: 30 },
  ];
  specialSheet.addRows([
    { lang: 'German', text: 'Größe, Äpfel, Öl' },
    { lang: 'French', text: 'Café, résumé, naïve' },
    { lang: 'With Pipe', text: 'Column | Separator' },
  ]);

  await specialWorkbook.xlsx.writeFile(join(fixturesDir, 'special-chars.xlsx'));
  console.log('✓ Created special-chars.xlsx');

  console.log('\n✓ All Excel fixtures created successfully');
}

createExcelFiles().catch(error => {
  console.error('Error creating Excel files:', error);
  process.exit(1);
});
