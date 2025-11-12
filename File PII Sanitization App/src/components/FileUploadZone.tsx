import { useCallback, useState } from 'react';
import { Upload, FileText, FileSpreadsheet, File } from 'lucide-react';
import { Card } from './ui/card';
import { FileInfo } from '../types';
import { parseFile } from '../utils/fileParser';

interface FileUploadZoneProps {
  onFileUpload: (fileInfo: FileInfo) => void;
}

export function FileUploadZone({ onFileUpload }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    const fileInfo = await parseFile(file);
    onFileUpload(fileInfo);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [onFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <Card
      className={`border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="p-12 text-center">
        <div className="flex justify-center mb-6">
          <div
            className={`p-6 rounded-full ${
              isDragging ? 'bg-blue-100' : 'bg-slate-100'
            } transition-colors`}
          >
            <Upload
              className={`w-12 h-12 ${
                isDragging ? 'text-blue-600' : 'text-slate-400'
              }`}
            />
          </div>
        </div>

        <h2 className="text-slate-900 mb-2">Drop your file here</h2>
        <p className="text-slate-600 mb-6">
          or click to browse from your computer
        </p>

        <label className="inline-block">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
            onChange={handleFileInput}
          />
          <span className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            Browse Files
          </span>
        </label>

        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-slate-500 mb-4">Supported formats:</p>
          <div className="flex justify-center gap-4 flex-wrap">
            {[
              { icon: FileText, label: 'PDF', color: 'text-red-500' },
              { icon: FileText, label: 'Word', color: 'text-blue-500' },
              { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-500' },
              { icon: File, label: 'CSV', color: 'text-purple-500' },
            ].map((format) => (
              <div
                key={format.label}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg"
              >
                <format.icon className={`w-4 h-4 ${format.color}`} />
                <span className="text-slate-700">{format.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
