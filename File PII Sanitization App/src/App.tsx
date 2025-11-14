import { useState } from 'react';
import { FileUploadZone } from './components/FileUploadZone';
import { FileMetadataPanel } from './components/FileMetadataPanel';
import { FilePreview } from './components/FilePreview';
import { ProcessingOutput } from './components/ProcessingOutput';
import { FileInfo } from './types';

export default function App() {
  const [uploadedFile, setUploadedFile] = useState<FileInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (fileInfo: FileInfo) => {
    setUploadedFile(fileInfo);
    setIsProcessing(true);
    // Simulate processing time
    setTimeout(() => {
      setIsProcessing(false);
    }, 1500);
  };

  const handleReset = () => {
    setUploadedFile(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-slate-900 mb-2">PII Sanitizer</h1>
          <p className="text-slate-600">
            Upload documents to automatically detect and sanitize personally identifiable information
          </p>
        </div>

        {!uploadedFile ? (
          <FileUploadZone onFileUpload={handleFileUpload} />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <FileMetadataPanel file={uploadedFile} onReset={handleReset} />
              <FilePreview file={uploadedFile} />
            </div>
            <div className="lg:col-span-2">
              <ProcessingOutput file={uploadedFile} isProcessing={isProcessing} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
