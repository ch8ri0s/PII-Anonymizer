import { SanitizationResult, PiiChange } from '../types';

export function sanitizePii(content: string, fileType: string): SanitizationResult {
  const changes: PiiChange[] = [];
  let sanitizedContent = content;

  // Email patterns
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  let emailCounter = 1;
  while ((match = emailRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[EMAIL_${emailCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Email',
      location: `Position ${match.index}`,
    });
    emailCounter++;
  }

  // Phone number patterns
  const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  let phoneCounter = 1;
  while ((match = phoneRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[PHONE_${phoneCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Phone',
      location: `Position ${match.index}`,
    });
    phoneCounter++;
  }

  // SSN patterns
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  let ssnCounter = 1;
  while ((match = ssnRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[SSN_${ssnCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'SSN',
      location: `Position ${match.index}`,
    });
    ssnCounter++;
  }

  // Credit card patterns
  const ccRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  let ccCounter = 1;
  while ((match = ccRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[CREDIT_CARD_${ccCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Credit Card',
      location: `Position ${match.index}`,
    });
    ccCounter++;
  }

  // Address patterns (simplified)
  const addressRegex = /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way)[.,\s]+[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}\b/gi;
  let addressCounter = 1;
  while ((match = addressRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[ADDRESS_${addressCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Address',
      location: `Position ${match.index}`,
    });
    addressCounter++;
  }

  // Date of Birth patterns
  const dobRegex = /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g;
  let dobCounter = 1;
  while ((match = dobRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `[DATE_OF_BIRTH_${dobCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Date of Birth',
      location: `Position ${match.index}`,
    });
    dobCounter++;
  }

  // Account numbers (simplified pattern)
  const accountRegex = /\b(?:Account|Acct)(?:\s*#?:?\s*)\d{10,}\b/gi;
  let accountCounter = 1;
  while ((match = accountRegex.exec(content)) !== null) {
    const original = match[0];
    const replacement = `Account: [ACCOUNT_${accountCounter}]`;
    sanitizedContent = sanitizedContent.replace(original, replacement);
    changes.push({
      original,
      replacement,
      type: 'Account Number',
      location: `Position ${match.index}`,
    });
    accountCounter++;
  }

  // Convert to markdown format
  const markdownContent = convertToMarkdown(sanitizedContent, fileType);

  return {
    sanitizedContent: markdownContent,
    changes,
    piiDetected: changes.length,
  };
}

function convertToMarkdown(content: string, fileType: string): string {
  // If already in markdown-like format, return as-is
  if (content.includes('#') || content.includes('##')) {
    return content;
  }

  // For CSV content, convert to markdown table
  if (fileType.includes('csv') || content.includes(',')) {
    const lines = content.trim().split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',');
      let markdown = '# Data Export\n\n';
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
      
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',');
        markdown += '| ' + cells.join(' | ') + ' |\n';
      }
      
      return markdown;
    }
  }

  // For other content, add basic markdown formatting
  return `# Document Export\n\n${content}`;
}
