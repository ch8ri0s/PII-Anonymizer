import { FileInfo } from '../types';

export async function parseFile(file: File): Promise<FileInfo> {
  const content = await extractContent(file);
  const preview = content.substring(0, 500) + (content.length > 500 ? '...' : '');

  return {
    file,
    name: file.name,
    size: file.size,
    type: file.type || getFileType(file.name),
    lastModified: new Date(file.lastModified),
    preview,
    content,
  };
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}

async function extractContent(file: File): Promise<string> {
  // For demo purposes, we'll use mock content based on file type
  // In a real application, you would use libraries like:
  // - pdf.js for PDFs
  // - mammoth.js for Word docs
  // - xlsx for Excel files
  // - Papa Parse for CSV

  const type = file.type || getFileType(file.name);

  if (type.includes('csv') || file.name.endsWith('.csv')) {
    return await readTextFile(file);
  }

  // Mock content for binary files
  return generateMockContent(file.name, type);
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function generateMockContent(filename: string, type: string): string {
  const templates = {
    pdf: `# ${filename}

## Document Overview
This is a sample document containing various information about our organization and personnel.

## Employee Information
Name: John Smith
Email: john.smith@example.com
Phone: (555) 123-4567
SSN: 123-45-6789
Address: 123 Main Street, Springfield, IL 62701

## Project Details
Project Manager: Sarah Johnson (sarah.j@example.com)
Budget: $150,000
Timeline: Q1 2025 - Q4 2025

## Financial Information
Account Number: 9876543210
Credit Card: 4532-1234-5678-9010

## Additional Notes
Please contact our office at 555-987-6543 for more information.`,

    word: `# Meeting Notes - ${filename}

Date: November 10, 2025
Attendees: 
- John Smith (john.smith@example.com)
- Emily Davis (emily.davis@company.com)
- Michael Chen (michael.chen@company.com)

## Discussion Points

1. Project Timeline
   - Lead: Sarah Johnson
   - Contact: (555) 234-5678
   - Email: sarah.johnson@example.com

2. Budget Allocation
   - Account: 1234-5678-9012-3456
   - Approved by: Robert Wilson
   - Employee ID: EMP-98765

3. Privacy Compliance
   - SSN verification required for: 123-45-6789
   - Date of Birth: 05/15/1985
   - Driver's License: DL-123456789

## Action Items
- Follow up with Jennifer Lee at jennifer.lee@example.com
- Schedule call with office: +1-555-345-6789`,

    excel: `Name,Email,Phone,SSN,Department,Salary
John Smith,john.smith@example.com,(555) 123-4567,123-45-6789,Engineering,$95000
Sarah Johnson,sarah.j@example.com,(555) 234-5678,234-56-7890,Marketing,$87000
Michael Chen,michael.chen@company.com,(555) 345-6789,345-67-8901,Sales,$92000
Emily Davis,emily.davis@company.com,(555) 456-7890,456-78-9012,HR,$78000
Robert Wilson,robert.w@example.com,(555) 567-8901,567-89-0123,Finance,$105000

# Financial Summary
Account Number,Balance,Card Number
9876543210,$50000,4532-1234-5678-9010
1234567890,$75000,5412-9876-5432-1098`,

    csv: `Name,Email,Phone,SSN,Address
John Smith,john.smith@example.com,(555) 123-4567,123-45-6789,"123 Main St, Springfield, IL 62701"
Sarah Johnson,sarah.j@example.com,(555) 234-5678,234-56-7890,"456 Oak Ave, Chicago, IL 60601"
Michael Chen,michael.chen@company.com,(555) 345-6789,345-67-8901,"789 Pine Rd, Boston, MA 02101"`,
  };

  if (type.includes('pdf')) return templates.pdf;
  if (type.includes('word') || type.includes('document')) return templates.word;
  if (type.includes('sheet') || type.includes('excel')) return templates.excel;
  if (type.includes('csv')) return templates.csv;

  return templates.pdf;
}
