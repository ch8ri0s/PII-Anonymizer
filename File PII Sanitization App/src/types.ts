export interface FileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  preview: string;
  content: string;
}

export interface PiiChange {
  original: string;
  replacement: string;
  type: string;
  location: string;
}

export interface SanitizationResult {
  sanitizedContent: string;
  changes: PiiChange[];
  piiDetected: number;
}
