/**
 * Test File Fixtures for E2E Tests
 *
 * Provides utility functions to create test files with known PII patterns
 * for comprehensive end-to-end testing.
 */

/**
 * File info structure for Playwright's setInputFiles
 */
export interface TestFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Sample text content with various PII types
 */
export const SAMPLE_PII_TEXT = `
Dear John Smith,

Thank you for your inquiry. Please find the information below:

Contact Information:
- Email: john.smith@example.com
- Phone: +41 44 123 45 67
- Mobile: +33 6 12 34 56 78

Personal Details:
- SSN: 756.1234.5678.97
- IBAN: CH93 0076 2011 6238 5295 7
- Credit Card: 4532-1488-0343-6467

Address:
123 Main Street
8001 Zürich, Switzerland

Best regards,
Customer Service Team
support@company.com
Tax ID: CHE-123.456.789
`;

/**
 * Sample CSV with PII data
 */
export const SAMPLE_PII_CSV = `Name,Email,Phone,SSN,City
John Smith,john.smith@example.com,+41 44 123 45 67,756.1234.5678.97,Zürich
Marie Dupont,marie.dupont@example.fr,+33 1 23 45 67 89,2 95 07 49 588 157 32,Paris
Hans Mueller,hans.mueller@example.de,+49 30 12345678,12 345678 A 123,Berlin
`;

/**
 * Sample Markdown with code blocks (should preserve PII in code)
 */
export const SAMPLE_MARKDOWN_WITH_CODE = `
# User Documentation

Contact our support team at support@example.com.

## Example Configuration

\`\`\`json
{
  "email": "config@example.com",
  "apiKey": "should-not-be-anonymized"
}
\`\`\`

For assistance, call +41 44 123 45 67.
`;

/**
 * Creates a text file for Playwright
 */
export function createTextFile(content: string, filename: string = 'test.txt'): TestFile {
  return {
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from(content, 'utf-8'),
  };
}

/**
 * Creates a CSV file for Playwright
 */
export function createCSVFile(content: string, filename: string = 'test.csv'): TestFile {
  return {
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf-8'),
  };
}

/**
 * Creates a markdown file for Playwright
 */
export function createMarkdownFile(content: string, filename: string = 'test.md'): TestFile {
  return {
    name: filename,
    mimeType: 'text/markdown',
    buffer: Buffer.from(content, 'utf-8'),
  };
}

/**
 * Creates a simple PDF using data URL (minimal PDF structure)
 */
export function createSimplePDF(text: string, filename: string = 'test.pdf'): TestFile {
  // Minimal PDF structure with text
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
50 700 Td
(${text.replace(/\n/g, ' ').slice(0, 100)}) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000262 00000 n
0000000356 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
443
%%EOF`;

  return {
    name: filename,
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfContent, 'utf-8'),
  };
}

/**
 * Expected PII counts for validation
 */
export const EXPECTED_PII_COUNTS = {
  TEXT_FILE: {
    EMAIL: 2,
    PHONE: 2,
    // Other types may vary based on detector patterns
  },
  CSV_FILE: {
    EMAIL: 3,
    PHONE: 3,
    // Rows with PII
  },
};
